import "server-only";

import { and, asc, count, eq } from "drizzle-orm";

import { getAutomation, getConnectedAccount, otherLiveAutomations, type ConnectedAccount } from "@/lib/data";
import { db, schema } from "@/lib/db";

import { defaultAutomationContent } from "./defaults";
import { automationContentSchema, type Automation, type AutomationContent } from "./schemas";
import { errorCount, findConflict, validateForLive, validateLimits, type FieldErrors } from "./validate";

/**
 * Every automation write, for one user. The Server Actions (`src/lib/actions.ts`)
 * and the MCP tools (`src/lib/mcp/`) both call these, so the rules (limits,
 * Go Live checks, the conflict rule) can't drift between the app and Claude.
 * Automations are only ever reached through the user's own account.
 */

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: "error"; message: string }
  | { ok: false; reason: "invalid"; count: number; errors: FieldErrors }
  | { ok: false; reason: "conflict"; message: string; conflictId: string };

/** A problem the user can fix, shown to them as is. */
export class ServiceError extends Error {}

export async function requireAccount(userId: string): Promise<ConnectedAccount> {
  const account = await getConnectedAccount(userId);
  if (!account) throw new ServiceError("Connect an Instagram account first.");
  return account;
}

export async function pauseLive(accountId: string) {
  await db().update(schema.automations).set({ status: "paused", updatedAt: new Date() }).where(and(eq(schema.automations.accountId, accountId), eq(schema.automations.status, "live")));
}

/**
 * Validation for anything that ends up live (FR-7.2, FR-7.3): every field,
 * then no overlap with another live automation on the same post.
 */
async function checkLive(accountId: string, id: string, content: AutomationContent): Promise<ActionResult | null> {
  const errors = validateForLive(content);
  const invalid = errorCount(errors);
  if (invalid) return { ok: false, reason: "invalid", count: invalid, errors };
  const conflict = findConflict(content, id, await otherLiveAutomations(accountId, id));
  if (!conflict) return null;
  const detail = conflict.reason === "keyword" ? `also uses the keyword ${conflict.keyword?.toUpperCase()}` : "already answers every comment";
  return { ok: false, reason: "conflict", message: `"${conflict.automation.name}" is live on ${scopePhrase(content.trigger.postScope)} and ${detail}.`, conflictId: conflict.automation.id };
}

function scopePhrase(scope: AutomationContent["trigger"]["postScope"]) {
  if (scope === "next") return "your next post";
  if (scope === "any") return "every post";
  return "this post";
}

export function parseContent(input: unknown): AutomationContent {
  const parsed = automationContentSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("That automation doesn't look right. Reload and try again.");
  const errors = validateLimits(parsed.data);
  const limits = errorCount(errors);
  if (limits) throw new ServiceError(`${limits} ${limits === 1 ? "field is" : "fields are"} over the limit: ${Object.values(errors).join(" ")}`);
  return parsed.data;
}

export async function loadOwn(userId: string, id: string): Promise<{ account: ConnectedAccount; automation: Automation }> {
  const account = await requireAccount(userId);
  const automation = await getAutomation(account.id, id);
  if (!automation) throw new ServiceError("This automation doesn't exist any more.");
  return { account, automation };
}

/** A new Draft. `content` replaces the defaults it names (MCP passes some; the app passes none). */
export async function createAutomation(userId: string, content: Partial<AutomationContent> = {}): Promise<{ id: string }> {
  const account = await requireAccount(userId);
  const [{ total }] = await db().select({ total: count() }).from(schema.automations).where(eq(schema.automations.accountId, account.id));
  const values = parseContent({ ...defaultAutomationContent(total), ...content });
  const [row] = await db().insert(schema.automations).values({ accountId: account.id, ...values }).returning({ id: schema.automations.id });
  return { id: row.id };
}

/** Saves content. Saving a live automation applies at once, so it must pass Go Live checks (D4). */
export async function saveAutomation(userId: string, id: string, input: unknown): Promise<ActionResult> {
  const content = parseContent(input);
  const { account, automation } = await loadOwn(userId, id);
  if (automation.status === "live") {
    const rejected = await checkLive(account.id, id, content);
    if (rejected) return rejected;
  }
  await db().update(schema.automations).set({ ...content, updatedAt: new Date() }).where(eq(schema.automations.id, id));
  return { ok: true };
}

/** Saves `input` when given (the editor), then goes live. */
export async function goLive(userId: string, id: string, input?: unknown): Promise<ActionResult> {
  const { account, automation } = await loadOwn(userId, id);
  const content = input ? parseContent(input) : automation;
  const rejected = await checkLive(account.id, id, content);
  if (rejected) return rejected;
  const now = new Date();
  const { name, commentReply, openingDm, emailCapture, finalDm } = content;
  // A Next post automation starts waiting again from now: forget any post an earlier run bound.
  const trigger = content.trigger.postScope === "next" ? { ...content.trigger, mediaId: null, mediaSnapshot: null } : content.trigger;
  await db().update(schema.automations).set({ name, trigger, commentReply, openingDm, emailCapture, finalDm, status: "live", liveAt: now, updatedAt: now }).where(eq(schema.automations.id, id));
  return { ok: true };
}

export async function pauseAutomation(userId: string, id: string): Promise<void> {
  await loadOwn(userId, id);
  await db().update(schema.automations).set({ status: "paused", updatedAt: new Date() }).where(eq(schema.automations.id, id));
}

export async function duplicateAutomation(userId: string, id: string): Promise<{ id: string }> {
  const { account, automation } = await loadOwn(userId, id);
  const { trigger, commentReply, openingDm, emailCapture, finalDm } = automation;
  const [row] = await db().insert(schema.automations).values({
    accountId: account.id,
    name: `${automation.name} (copy)`.slice(0, 80),
    trigger,
    commentReply,
    openingDm,
    emailCapture,
    finalDm,
  }).returning({ id: schema.automations.id });
  return { id: row.id };
}

export async function deleteAutomation(userId: string, id: string): Promise<void> {
  await loadOwn(userId, id);
  await db().delete(schema.automations).where(eq(schema.automations.id, id));
}

/**
 * Forgets everyone this automation has messaged, so the same people can
 * trigger it again. Handy when testing with one account. Clears its stats too.
 */
export async function resetRuns(userId: string, id: string): Promise<{ count: number }> {
  await loadOwn(userId, id);
  const deleted = await db().delete(schema.runs).where(eq(schema.runs.automationId, id)).returning({ id: schema.runs.id });
  return { count: deleted.length };
}

export type Lead = { igUsername: string | null; igUserId: string; email: string; createdAt: string };

/** Emails the automation's email step collected, oldest first. */
export async function listLeads(userId: string, id: string): Promise<{ automation: Automation; leads: Lead[] }> {
  const { automation } = await loadOwn(userId, id);
  const rows = await db().select().from(schema.leads).where(eq(schema.leads.automationId, id)).orderBy(asc(schema.leads.createdAt));
  return { automation, leads: rows.map((row) => ({ igUsername: row.igUsername, igUserId: row.igUserId, email: row.email, createdAt: row.createdAt.toISOString() })) };
}

/** RFC 4180 quoting, plus a leading quote on anything a spreadsheet would run as a formula. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function leadsCsv(leads: Lead[]) {
  const rows = [["Email", "Instagram username", "Instagram user id", "Captured at"], ...leads.map((lead) => [lead.email, lead.igUsername ?? "", lead.igUserId, lead.createdAt])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
