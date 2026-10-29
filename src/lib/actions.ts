"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { markKeyStatus, getAppSettings } from "@/lib/app-settings";
import { listInstagramAccounts, listProfiles } from "@/lib/adeli/instagram";
import { getAdeliConfig } from "@/lib/adeli/key";
import { AdeliError, adeliKeyPrefix } from "@/lib/adeli/types";
import { defaultAutomationContent } from "@/lib/automations/defaults";
import { automationContentSchema, type AutomationContent } from "@/lib/automations/schemas";
import { errorCount, findConflict, validateForLive, validateLimits } from "@/lib/automations/validate";
import { getAutomation, getConnectedAccount, otherLiveAutomations, type ConnectedAccount } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { ensureAdeliWebhook } from "@/lib/runtime/webhook-registration";

/**
 * Every write the UI makes, as Server Actions backed by the database. There
 * is no login: Adeli Chat is a local demo of the Adeli API (PRD D2).
 */

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: "error"; message: string }
  | { ok: false; reason: "invalid"; count: number }
  | { ok: false; reason: "conflict"; message: string; conflictId: string };

export type KeyState =
  | { configured: false; message: string }
  | { configured: true; prefix: string; status: "valid" | "invalid" | "unchecked"; profileName: string | null; checkedAt: string | null; message: string | null };

class ActionError extends Error {}

async function guard<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ActionError || error instanceof AdeliError) return { ok: false, reason: "error", message: error.message };
    throw error;
  }
}

async function requireAccount(): Promise<ConnectedAccount> {
  const account = await getConnectedAccount();
  if (!account) throw new ActionError("Connect an Instagram account first.");
  return account;
}

async function pauseLive(accountId: string) {
  await db().update(schema.automations).set({ status: "paused", updatedAt: new Date() }).where(and(eq(schema.automations.accountId, accountId), eq(schema.automations.status, "live")));
}

function done<T extends object>(value: T = {} as T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, ...value };
}

/**
 * Checks `ADELI_API_KEY` against Adeli with `listProfiles`, records the result,
 * and returns what Setup and Settings show.
 */
export async function checkAdeliKey(): Promise<KeyState> {
  let prefix: string;
  try {
    prefix = adeliKeyPrefix(getAdeliConfig().apiKey);
  } catch (error) {
    return { configured: false, message: error instanceof Error ? error.message : "ADELI_API_KEY is not set on this server." };
  }
  let message: string | null = null;
  try {
    const [profile] = await listProfiles();
    if (profile) {
      await markKeyStatus("valid", profile);
      // Boot registers the webhook too, but a key fixed after boot only works from here.
      await ensureAdeliWebhook().catch((error: unknown) => console.warn(`Couldn't register the Adeli webhook: ${error instanceof Error ? error.message : String(error)}`));
    } else message = "This Adeli organization doesn't have a profile yet. Create one in Adeli.";
  } catch (error) {
    // `unauthorized` already marked the key invalid. A network error leaves the last result.
    message = error instanceof AdeliError ? error.message : "We couldn't reach Adeli. Try again in a minute.";
  }
  const settings = await getAppSettings();
  return {
    configured: true,
    prefix,
    status: settings.adeliKeyStatus,
    profileName: settings.adeliProfileName,
    checkedAt: settings.adeliKeyCheckedAt?.toISOString() ?? null,
    message,
  };
}

export async function testConnection(): Promise<ActionResult<{ key: KeyState }>> {
  return guard(async (): Promise<ActionResult<{ key: KeyState }>> => {
    const key = await checkAdeliKey();
    revalidatePath("/", "layout");
    if (!key.configured || key.message) return { ok: false, reason: "error", message: key.message ?? "Adeli didn't accept this key." };
    return { ok: true, key };
  });
}

/** Saves the account chosen on `/connect`, after checking this key can reach it. */
export async function connectAccount(adeliAccountId: string): Promise<ActionResult<{ handle: string }>> {
  return guard(async () => {
    const account = (await listInstagramAccounts()).find((item) => item.accountId === adeliAccountId);
    if (!account) throw new ActionError("This Adeli key can't reach that Instagram account. Refresh and pick another.");
    if (account.connectionStatus !== "connected") throw new ActionError("Reconnect this account in Adeli first.");
    const now = new Date();
    const values = {
      adeliProfileId: account.profileId ?? "",
      igUserId: account.providerId || null,
      handle: account.displayIdentifier,
      displayName: account.displayName,
      status: "connected" as const,
      updatedAt: now,
    };
    await db().transaction(async (tx) => {
      const [row] = await tx.insert(schema.accounts).values({ adeliAccountId, ...values })
        .onConflictDoUpdate({ target: schema.accounts.adeliAccountId, set: values })
        .returning({ id: schema.accounts.id });
      // One account at a time. Live automations on the old one can't run any more.
      await tx.update(schema.accounts).set({ status: "disconnected", updatedAt: now }).where(and(ne(schema.accounts.id, row.id), eq(schema.accounts.status, "connected")));
      await tx.update(schema.automations).set({ status: "paused", updatedAt: now }).where(and(ne(schema.automations.accountId, row.id), eq(schema.automations.status, "live")));
    });
    return done({ handle: account.displayIdentifier });
  });
}

/** Removes the account from Adeli Chat (not from Adeli) and pauses its live automations. */
export async function disconnectAccount(): Promise<ActionResult> {
  return guard(async () => {
    const account = await requireAccount();
    await pauseLive(account.id);
    await db().update(schema.accounts).set({ status: "disconnected", updatedAt: new Date() }).where(eq(schema.accounts.id, account.id));
    return done();
  });
}

export async function createAutomation(): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const account = await requireAccount();
    const [{ total }] = await db().select({ total: count() }).from(schema.automations);
    const [row] = await db().insert(schema.automations).values({ accountId: account.id, ...defaultAutomationContent(total) }).returning({ id: schema.automations.id });
    return done({ id: row.id });
  });
}

/**
 * Validation for anything that ends up live (FR-7.2, FR-7.3): every field,
 * then no overlap with another live automation on the same post.
 */
async function checkLive(accountId: string, id: string, content: AutomationContent): Promise<ActionResult | null> {
  const invalid = errorCount(validateForLive(content));
  if (invalid) return { ok: false, reason: "invalid", count: invalid };
  const conflict = findConflict(content, id, await otherLiveAutomations(accountId, id));
  if (!conflict) return null;
  const detail = conflict.reason === "keyword" ? `also uses the keyword ${conflict.keyword?.toUpperCase()}` : "already answers comments on this post";
  return { ok: false, reason: "conflict", message: `"${conflict.automation.name}" is live on this post and ${detail}.`, conflictId: conflict.automation.id };
}

function parseContent(input: unknown): AutomationContent {
  const parsed = automationContentSchema.safeParse(input);
  if (!parsed.success) throw new ActionError("That automation doesn't look right. Reload and try again.");
  const limits = errorCount(validateLimits(parsed.data));
  if (limits) throw new ActionError(`${limits} ${limits === 1 ? "field is" : "fields are"} over the limit.`);
  return parsed.data;
}

async function loadOwn(id: string) {
  const account = await requireAccount();
  const automation = await getAutomation(account.id, id);
  if (!automation) throw new ActionError("This automation doesn't exist any more.");
  return { account, automation };
}

/** Saves the editor. Saving a live automation applies at once, so it must pass Go Live checks (D4). */
export async function saveAutomation(id: string, input: AutomationContent): Promise<ActionResult> {
  return guard(async () => {
    const content = parseContent(input);
    const { account, automation } = await loadOwn(id);
    if (automation.status === "live") {
      const rejected = await checkLive(account.id, id, content);
      if (rejected) return rejected;
    }
    await db().update(schema.automations).set({ ...content, updatedAt: new Date() }).where(eq(schema.automations.id, id));
    return done();
  });
}

/** Saves `input` when given (the editor), then goes live. */
export async function goLive(id: string, input?: AutomationContent): Promise<ActionResult> {
  return guard(async () => {
    const { account, automation } = await loadOwn(id);
    const content = input ? parseContent(input) : automation;
    const rejected = await checkLive(account.id, id, content);
    if (rejected) return rejected;
    const now = new Date();
    const { name, trigger, commentReply, openingDm, finalDm } = content;
    await db().update(schema.automations).set({ name, trigger, commentReply, openingDm, finalDm, status: "live", liveAt: now, updatedAt: now }).where(eq(schema.automations.id, id));
    return done();
  });
}

export async function pauseAutomation(id: string): Promise<ActionResult> {
  return guard(async () => {
    await loadOwn(id);
    await db().update(schema.automations).set({ status: "paused", updatedAt: new Date() }).where(eq(schema.automations.id, id));
    return done();
  });
}

export async function duplicateAutomation(id: string): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const { account, automation } = await loadOwn(id);
    const { trigger, commentReply, openingDm, finalDm } = automation;
    const [row] = await db().insert(schema.automations).values({
      accountId: account.id,
      name: `${automation.name} (copy)`.slice(0, 80),
      trigger,
      commentReply,
      openingDm,
      finalDm,
    }).returning({ id: schema.automations.id });
    return done({ id: row.id });
  });
}

export async function deleteAutomation(id: string): Promise<ActionResult> {
  return guard(async () => {
    await loadOwn(id);
    await db().delete(schema.automations).where(eq(schema.automations.id, id));
    return done();
  });
}
