"use server";

import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { listInstagramAccounts, listProfiles } from "@/lib/adeli/instagram";
import { DEFAULT_BASE_URL, findAdeliConfig, normalizeBaseURL, type KeySource } from "@/lib/adeli/key";
import { AdeliError, adeliKeyPrefix } from "@/lib/adeli/types";
import { authEnabled, googleCredentials } from "@/lib/auth/config";
import { auth } from "@/lib/auth/server";
import { requireUserId, SignedOutError } from "@/lib/auth/session";
import { defaultAutomationContent } from "@/lib/automations/defaults";
import { automationContentSchema, type AutomationContent } from "@/lib/automations/schemas";
import { errorCount, findConflict, validateForLive, validateLimits } from "@/lib/automations/validate";
import { getAutomation, getConnectedAccount, otherLiveAutomations, type ConnectedAccount } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { ensureAdeliWebhook } from "@/lib/runtime/webhook-registration";
import { sealSecret } from "@/lib/secret-box";
import { getUserSettings, markKeyStatus, saveAdeliConnection as storeAdeliConnection } from "@/lib/user-settings";

/**
 * Every write the UI makes, as Server Actions backed by the database. Server
 * Actions are public endpoints, so each one resolves the signed-in user first
 * (`guard`, `requireUserId`) and only touches that user's data: their Adeli
 * settings, and automations reached through their own Instagram account.
 */

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: "error"; message: string }
  | { ok: false; reason: "invalid"; count: number }
  | { ok: false; reason: "conflict"; message: string; conflictId: string };

export type KeyState =
  | { configured: false; message: string; baseURL: string }
  | { configured: true; prefix: string; source: KeySource; baseURL: string; status: "valid" | "invalid" | "unchecked"; profileName: string | null; checkedAt: string | null; message: string | null };

class ActionError extends Error {}

async function guard<T>(run: (userId: string) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run(await requireUserId());
  } catch (error) {
    if (error instanceof ActionError || error instanceof AdeliError || error instanceof SignedOutError) return { ok: false, reason: "error", message: error.message };
    throw error;
  }
}

async function requireAccount(userId: string): Promise<ConnectedAccount> {
  const account = await getConnectedAccount(userId);
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

/** The last recorded key check, without asking Adeli. "Test connection" asks again. */
export async function lastKeyState(): Promise<KeyState> {
  const userId = await requireUserId();
  let config;
  try {
    config = await findAdeliConfig(userId);
  } catch (error) {
    return { configured: false, message: error instanceof Error ? error.message : "The Adeli settings aren't valid.", baseURL: DEFAULT_BASE_URL };
  }
  const settings = await getUserSettings(userId);
  if (!config) return { configured: false, message: "Add your Adeli API key to start.", baseURL: settings.adeliBaseUrl ?? DEFAULT_BASE_URL };
  return {
    configured: true,
    prefix: adeliKeyPrefix(config.apiKey),
    source: config.source,
    baseURL: config.baseURL,
    status: settings.adeliKeyStatus,
    profileName: settings.adeliProfileName,
    checkedAt: settings.adeliKeyCheckedAt?.toISOString() ?? null,
    message: null,
  };
}

/**
 * Checks the configured key against Adeli with `listProfiles`, records the
 * result, registers the webhook, and returns what Setup and Settings show.
 */
export async function checkAdeliKey(): Promise<KeyState> {
  const userId = await requireUserId();
  const last = await lastKeyState();
  if (!last.configured) return last;
  let message: string | null = null;
  try {
    const [profile] = await listProfiles(userId);
    if (profile) {
      await markKeyStatus(userId, "valid", profile);
      // This also moves the webhook to the current URL when APP_URL or the domain changed.
      await ensureAdeliWebhook(userId).catch((error: unknown) => console.warn(`Couldn't register the Adeli webhook: ${error instanceof Error ? error.message : String(error)}`));
    } else message = "This Adeli organization doesn't have a profile yet. Create one in Adeli.";
  } catch (error) {
    // `unauthorized` already marked the key invalid. A network error leaves the last result.
    message = error instanceof AdeliError ? error.message : "We couldn't reach Adeli. Try again in a minute.";
  }
  return { ...(await lastKeyState()), message } as KeyState;
}

/**
 * Saves the Adeli key and URL entered in Setup or Settings. The key is tried
 * against Adeli first and only stored, encrypted, when Adeli accepts it. An
 * empty key keeps the saved one, so you can change just the URL.
 */
export async function saveAdeliConnection(input: { apiKey: string; baseURL: string }): Promise<ActionResult<{ key: KeyState }>> {
  return guard(async (userId): Promise<ActionResult<{ key: KeyState }>> => {
    const baseURL = normalizeBaseURL(input.baseURL.trim() || DEFAULT_BASE_URL);
    const typed = input.apiKey.trim();
    if (typed && !/^rk_(live|test)_[A-Za-z0-9_-]{8,}$/.test(typed)) throw new ActionError("That doesn't look like an Adeli API key. It starts with rk_live_.");
    const current = await findAdeliConfig(userId).catch(() => null);
    const apiKey = typed || current?.apiKey;
    if (!apiKey) throw new ActionError("Paste your Adeli API key.");

    const profiles = await listProfiles(userId, { baseURL, apiKey });
    if (!profiles.length) throw new ActionError("This Adeli organization doesn't have a profile yet. Create one in Adeli.");
    const settings = await getUserSettings(userId);
    await storeAdeliConnection(userId, {
      sealedApiKey: typed ? sealSecret(typed) : undefined,
      baseUrl: baseURL === DEFAULT_BASE_URL ? null : baseURL,
      keepProfile: profiles.some((profile) => profile.id === settings.adeliProfileId),
    });
    const key = await checkAdeliKey();
    revalidatePath("/", "layout");
    if (!key.configured || key.message) return { ok: false, reason: "error", message: key.message ?? "Adeli didn't accept this key." };
    return { ok: true, key };
  });
}

/** Starts Google sign-in and sends the browser to Google. */
export async function signInWithGoogle(): Promise<void> {
  if (!googleCredentials()) throw new Error("Google sign-in isn't configured on this server.");
  const result = await auth().api.signInSocial({ body: { provider: "google", callbackURL: "/automations", errorCallbackURL: "/sign-in" }, headers: await headers() });
  if (!result.url) throw new Error("Google sign-in didn't return a URL.");
  redirect(result.url);
}

export async function signOut(): Promise<void> {
  if (authEnabled()) await auth().api.signOut({ headers: await headers() }).catch(() => undefined);
  redirect("/sign-in");
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
  return guard(async (userId) => {
    const account = (await listInstagramAccounts(userId)).find((item) => item.accountId === adeliAccountId);
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
      // Reconnecting in Adeli gives the same Instagram account a new Adeli id. Keep its row, so its automations and runs follow.
      const [same] = values.igUserId
        ? await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.igUserId, values.igUserId))).limit(1)
        : [];
      const [row] = same
        ? await tx.update(schema.accounts).set({ adeliAccountId, ...values }).where(eq(schema.accounts.id, same.id)).returning({ id: schema.accounts.id })
        : await tx.insert(schema.accounts).values({ userId, adeliAccountId, ...values })
          .onConflictDoUpdate({ target: [schema.accounts.userId, schema.accounts.adeliAccountId], set: values })
          .returning({ id: schema.accounts.id });
      // One account per user at a time. Live automations on their old one can't run any more.
      const others = tx.select({ id: schema.accounts.id }).from(schema.accounts).where(and(eq(schema.accounts.userId, userId), ne(schema.accounts.id, row.id)));
      await tx.update(schema.accounts).set({ status: "disconnected", updatedAt: now }).where(and(inArray(schema.accounts.id, others), eq(schema.accounts.status, "connected")));
      await tx.update(schema.automations).set({ status: "paused", updatedAt: now }).where(and(inArray(schema.automations.accountId, others), eq(schema.automations.status, "live")));
    });
    return done({ handle: account.displayIdentifier });
  });
}

/** Removes the account from Adeli Chat (not from Adeli) and pauses its live automations. */
export async function disconnectAccount(): Promise<ActionResult> {
  return guard(async (userId) => {
    const account = await requireAccount(userId);
    await pauseLive(account.id);
    await db().update(schema.accounts).set({ status: "disconnected", updatedAt: new Date() }).where(eq(schema.accounts.id, account.id));
    return done();
  });
}

export async function createAutomation(): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const account = await requireAccount(userId);
    const [{ total }] = await db().select({ total: count() }).from(schema.automations).where(eq(schema.automations.accountId, account.id));
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

async function loadOwn(userId: string, id: string) {
  const account = await requireAccount(userId);
  const automation = await getAutomation(account.id, id);
  if (!automation) throw new ActionError("This automation doesn't exist any more.");
  return { account, automation };
}

/** Saves the editor. Saving a live automation applies at once, so it must pass Go Live checks (D4). */
export async function saveAutomation(id: string, input: AutomationContent): Promise<ActionResult> {
  return guard(async (userId) => {
    const content = parseContent(input);
    const { account, automation } = await loadOwn(userId, id);
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
  return guard(async (userId) => {
    const { account, automation } = await loadOwn(userId, id);
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
  return guard(async (userId) => {
    await loadOwn(userId, id);
    await db().update(schema.automations).set({ status: "paused", updatedAt: new Date() }).where(eq(schema.automations.id, id));
    return done();
  });
}

export async function duplicateAutomation(id: string): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const { account, automation } = await loadOwn(userId, id);
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
  return guard(async (userId) => {
    await loadOwn(userId, id);
    await db().delete(schema.automations).where(eq(schema.automations.id, id));
    return done();
  });
}

/**
 * Forgets everyone this automation has messaged, so the same people can
 * trigger it again. Handy when testing with one account. Clears its stats too.
 */
export async function resetRuns(id: string): Promise<ActionResult<{ count: number }>> {
  return guard(async (userId) => {
    await loadOwn(userId, id);
    const deleted = await db().delete(schema.runs).where(eq(schema.runs.automationId, id)).returning({ id: schema.runs.id });
    return done({ count: deleted.length });
  });
}
