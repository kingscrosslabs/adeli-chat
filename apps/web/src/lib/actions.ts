"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { listInstagramAccounts } from "@/lib/adeli/instagram";
import { renameLocalProfile as renameProfile } from "@/lib/adeli/profile";
import { AdeliError } from "@/lib/adeli/types";
import { authEnabled, googleCredentials } from "@/lib/auth/config";
import { auth } from "@/lib/auth/server";
import { requireUserId, SignedOutError } from "@/lib/auth/session";
import { automationTypeSchema, type AutomationContent } from "@adeli-chat/ui/automation/schemas";
import * as service from "@/lib/automations/service";
import { pauseLive, requireAccount, ServiceError, type ActionResult } from "@/lib/automations/service";
import { db, schema } from "@/lib/db";
import { disconnectApp } from "@/lib/mcp/connections";
import { submitConsent } from "@/lib/mcp/consent";
import { createToken, revealToken, revokeToken, TOKEN_EXPIRY_OPTIONS, type TokenExpiry } from "@/lib/mcp/tokens";
import { ensureAdeliWebhook } from "@/lib/runtime/webhook-registration";

/**
 * Every write the UI makes, as Server Actions backed by the database. Server
 * Actions are public endpoints, so each one resolves the signed-in user first
 * (`guard`, `requireUserId`) and only touches that user's data: their Adeli
 * profile, and automations reached through their own Instagram account.
 */

export type { ActionResult };

/** A problem the user can fix, shown to them as is. */
class ActionError extends ServiceError {}

async function guard<T>(run: (userId: string) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run(await requireUserId());
  } catch (error) {
    if (error instanceof ServiceError || error instanceof AdeliError || error instanceof SignedOutError) return { ok: false, reason: "error", message: error.message };
    throw error;
  }
}

function done<T extends object>(value: T = {} as T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, ...value };
}

/** A service result: refreshes pages when it worked. */
function settled(result: ActionResult): ActionResult {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * Starts Google sign-in and sends the browser to Google. When sign-in is part
 * of an OAuth request (Claude connecting to `/mcp`), the form carries the
 * signed `oauth_query`, and Better Auth resumes that request after Google.
 */
export async function signInWithGoogle(form?: FormData): Promise<void> {
  if (!googleCredentials()) throw new Error("Google sign-in isn't configured on this server.");
  const oauthQuery = form?.get("oauth_query");
  const body = { provider: "google", callbackURL: "/automations", errorCallbackURL: "/sign-in", ...(typeof oauthQuery === "string" && oauthQuery ? { oauth_query: oauthQuery } : {}) };
  const result = await auth().api.signInSocial({ body, headers: await headers() });
  if (!result.url) throw new Error("Google sign-in didn't return a URL.");
  redirect(result.url);
}

export async function signOut(): Promise<void> {
  if (authEnabled()) await auth().api.signOut({ headers: await headers() }).catch(() => undefined);
  redirect("/sign-in");
}

/** Local development only: renames the local user's Adeli profile. `renameLocalProfile` refuses any other user. */
export async function renameLocalProfile(name: string): Promise<ActionResult<{ profileName: string }>> {
  return guard(async (userId) => {
    if (authEnabled()) throw new ActionError("Renaming the profile is only for local development.");
    const profile = await renameProfile(userId, String(name));
    return done({ profileName: profile.name });
  });
}

/**
 * Saves the account chosen or just connected on `/connect`, after checking
 * it's on the user's own Adeli profile, and registers their webhook.
 */
export async function connectAccount(adeliAccountId: string): Promise<ActionResult<{ handle: string }>> {
  return guard(async (userId) => {
    const account = (await listInstagramAccounts(userId)).find((item) => item.accountId === adeliAccountId);
    if (!account) throw new ActionError("That Instagram account isn't connected to your profile. Refresh and try again.");
    if (account.connectionStatus !== "connected") throw new ActionError("Instagram needs you to connect this account again. Click Connect Instagram.");
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
    // Comments on the account only reach LedaChat through the user's webhook.
    await ensureAdeliWebhook(userId).catch((error: unknown) => console.warn(`Couldn't register the Adeli webhook: ${error instanceof Error ? error.message : String(error)}`));
    return done({ handle: account.displayIdentifier });
  });
}

/** Removes the account from LedaChat (not from Adeli) and pauses its live automations. */
export async function disconnectAccount(): Promise<ActionResult> {
  return guard(async (userId) => {
    const account = await requireAccount(userId);
    await pauseLive(account.id);
    await db().update(schema.accounts).set({ status: "disconnected", updatedAt: new Date() }).where(eq(schema.accounts.id, account.id));
    return done();
  });
}

export async function createAutomation(type: unknown = "comment_to_dm"): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const parsed = automationTypeSchema.safeParse(type);
    if (!parsed.success) throw new ServiceError("That kind of automation isn't available yet.");
    return done(await service.createAutomation(userId, {}, parsed.data));
  });
}

/** Saves the editor. Saving a live automation applies at once, so it must pass Go Live checks (D4). */
export async function saveAutomation(id: string, input: AutomationContent): Promise<ActionResult> {
  return guard(async (userId) => settled(await service.saveAutomation(userId, id, input)));
}

/** Saves `input` when given (the editor), then goes live. */
export async function goLive(id: string, input?: AutomationContent): Promise<ActionResult> {
  return guard(async (userId) => settled(await service.goLive(userId, id, input)));
}

export async function pauseAutomation(id: string): Promise<ActionResult> {
  return guard(async (userId) => {
    await service.pauseAutomation(userId, id);
    return done();
  });
}

export async function duplicateAutomation(id: string): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => done(await service.duplicateAutomation(userId, id)));
}

export async function deleteAutomation(id: string): Promise<ActionResult> {
  return guard(async (userId) => {
    await service.deleteAutomation(userId, id);
    return done();
  });
}

/**
 * Forgets everyone this automation has messaged, so the same people can
 * trigger it again. Handy when testing with one account. Clears its stats too.
 */
export async function resetRuns(id: string): Promise<ActionResult<{ count: number }>> {
  return guard(async (userId) => done(await service.resetRuns(userId, id)));
}

/**
 * The consent page's answer for an OAuth request (Claude connecting to
 * `/mcp`). Without "Allow changes", the write scope is left out, so the
 * connection is read only. Better Auth then sends the browser back to the app.
 */
export async function answerConsent(form: FormData): Promise<void> {
  if (!authEnabled()) redirect("/automations");
  const oauthQuery = form.get("oauth_query");
  const requested = form.get("scope");
  if (typeof oauthQuery !== "string" || typeof requested !== "string") throw new Error("This sign-in request is incomplete. Start again from the app you were connecting.");
  const url = await submitConsent({
    cookie: (await headers()).get("cookie") ?? "",
    oauthQuery,
    requestedScope: requested,
    accept: form.get("decision") === "allow",
    allowWrite: form.get("allow_write") === "on",
  });
  redirect(url);
}

/** Creates an MCP API token. The full token is in the result and is never shown again. */
export async function createApiToken(input: { name: string; readOnly: boolean; expiry: TokenExpiry }): Promise<ActionResult<{ token: string }>> {
  return guard(async (userId) => {
    if (!TOKEN_EXPIRY_OPTIONS.includes(input.expiry)) throw new ActionError("Pick when the token expires.");
    const { token } = await createToken(userId, { name: input.name, readOnly: Boolean(input.readOnly), expiry: input.expiry });
    return done({ token });
  });
}

/** A token in full, for the reveal and copy buttons on Connect to AI Agent. */
export async function revealApiToken(id: string): Promise<ActionResult<{ token: string }>> {
  return guard(async (userId) => {
    const token = await revealToken(userId, id);
    if (!token) throw new ActionError("This token can't be revealed. It was created before tokens could be revealed, or it was revoked.");
    // Reading only, so no revalidation.
    return { ok: true as const, token };
  });
}

export async function revokeApiToken(id: string): Promise<ActionResult> {
  return guard(async (userId) => {
    if (!(await revokeToken(userId, id))) throw new ActionError("This token was already revoked.");
    return done();
  });
}

/** Disconnects an app connected through OAuth (like Claude), so it has to ask again. */
export async function disconnectMcpApp(clientId: string): Promise<ActionResult> {
  return guard(async (userId) => {
    await disconnectApp(userId, clientId);
    return done();
  });
}
