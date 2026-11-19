import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { after } from "next/server";

import { alertWentLive } from "@/lib/alerts/dopamine";
import { trackError, type Source } from "@/lib/analytics/server";
import { appUrl } from "@/lib/app-url";
import { getPlan, liveAutomationLimit } from "@/lib/billing/state";
import { getAutomation, getConnectedAccount, otherLiveAutomations, type ConnectedAccount } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { EARLIER_SEND_LIMIT, EARLIER_WINDOW_HOURS, findEarlierComments, sendEarlierComments, type EarlierComments } from "@/lib/runtime/earlier";

import { defaultAutomationContent } from "@adeli-chat/ui/automation/defaults";
import { automationContentSchema, followGateOf, type Automation, type AutomationContent, type AutomationType } from "@adeli-chat/ui/automation/schemas";
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
  | { ok: false; reason: "conflict"; message: string; conflictId: string }
  | { ok: false; reason: "limit"; message: string; limit: number; upgradeUrl: string }
  | { ok: false; reason: "pro"; message: string; upgradeUrl: string };

/** A problem the user can fix, shown to them as is. */
export class ServiceError extends Error {}

/** What an empty workspace needs next. MCP tools return it as `setup`; the agent calls `connect_instagram`. Never a URL. */
export type Setup = { next: "connect_instagram"; message: string; tool: "connect_instagram" };

export const CONNECT_INSTAGRAM_SETUP: Setup = { next: "connect_instagram", message: "Connect an Instagram professional account to continue.", tool: "connect_instagram" };

/**
 * The workspace has no Instagram account yet. A `ServiceError`, so Server
 * Actions show its message as before; MCP tools turn it into a normal result
 * with `setup` (never an auth error, which would restart OAuth).
 */
export class SetupRequired extends ServiceError {
  readonly setup: Setup = CONNECT_INSTAGRAM_SETUP;
  constructor() {
    super("Connect an Instagram account first.");
  }
}

/** Null once an Instagram account is connected, otherwise what to do next. */
export async function setupState(userId: string): Promise<Setup | null> {
  return (await getConnectedAccount(userId)) ? null : CONNECT_INSTAGRAM_SETUP;
}

export async function requireAccount(userId: string): Promise<ConnectedAccount> {
  const account = await getConnectedAccount(userId);
  if (!account) throw new SetupRequired();
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
  const story = content.type === "story_reply";
  const detail = conflict.reason === "keyword" ? `also uses the keyword ${conflict.keyword?.toUpperCase()}` : `already answers every ${story ? "reply" : "comment"}`;
  return { ok: false, reason: "conflict", message: `"${conflict.automation.name}" is live on ${scopePhrase(content)} and ${detail}.`, conflictId: conflict.automation.id };
}

function scopePhrase({ type, trigger: { postScope: scope } }: AutomationContent) {
  if (type === "story_reply") return scope === "specific" ? "this story" : "every story";
  if (scope === "next") return "your next post";
  if (scope === "any") return "every post";
  return "this post";
}

/** A type's fixed fields, whatever a caller sent: a story reply has no Next scope, never replies publicly and has no follow gate. */
function keepShape(content: AutomationContent): AutomationContent {
  if (content.type !== "story_reply") return content;
  const trigger = content.trigger.postScope === "next" ? { ...content.trigger, postScope: "specific" as const, mediaId: null, mediaSnapshot: null } : content.trigger;
  return { ...content, trigger, commentReply: { ...content.commentReply, enabled: false }, followGate: followGateOf(content) };
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

/** A new Draft of `type`. `content` replaces the defaults it names (MCP passes some; the app passes none). */
export async function createAutomation(userId: string, content: Partial<AutomationContent> = {}, type: AutomationType = "comment_to_dm"): Promise<{ id: string }> {
  const account = await requireAccount(userId);
  const [{ total }] = await db().select({ total: count() }).from(schema.automations).where(eq(schema.automations.accountId, account.id));
  const values = keepShape(parseContent({ ...defaultAutomationContent(total, type), ...content, type }));
  const [row] = await db().insert(schema.automations).values({ accountId: account.id, ...values }).returning({ id: schema.automations.id });
  return { id: row.id };
}

/** Saves content. Saving a live automation applies at once, so it must pass Go Live checks (D4). */
export async function saveAutomation(userId: string, id: string, input: unknown): Promise<ActionResult> {
  const { account, automation } = await loadOwn(userId, id);
  const content = keepShape({ ...parseContent(input), type: automation.type });
  if (automation.status === "live") {
    const rejected = await checkLive(account.id, id, content);
    if (rejected) return rejected;
  }
  await db().update(schema.automations).set({ ...content, updatedAt: new Date() }).where(eq(schema.automations.id, id));
  return { ok: true };
}

/** Where a Free user upgrades. */
export function upgradeUrl() {
  return `${appUrl()}/settings#plan`;
}

/**
 * Saves `input` when given (the editor), then goes live. An automation that
 * wasn't live already counts toward the plan's live limit (Free: 10). The
 * count and the update run under a per-user lock, so two Go Lives at 9
 * can't both pass. Drafts, saves and live edits are never limited.
 */
export async function goLive(userId: string, id: string, input?: unknown, source: Source = "app"): Promise<ActionResult> {
  const { account, automation } = await loadOwn(userId, id);
  const content = input ? keepShape({ ...parseContent(input), type: automation.type }) : automation;
  const rejected = await checkLive(account.id, id, content);
  if (rejected) return rejected;
  const wasLive = automation.status === "live";
  const limit = wasLive ? null : liveAutomationLimit(await getPlan(userId));
  const now = new Date();
  const { name, commentReply, openingDm, emailCapture, followGate, finalDm } = content;
  // A Next post automation starts waiting again from now: forget any post an earlier run bound.
  const trigger = content.trigger.postScope === "next" ? { ...content.trigger, mediaId: null, mediaSnapshot: null } : content.trigger;
  const refused = await db().transaction(async (tx) => {
    if (limit !== null) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`live:${userId}`}))`);
      const [{ live }] = await tx.select({ live: count() }).from(schema.automations)
        .innerJoin(schema.accounts, eq(schema.automations.accountId, schema.accounts.id))
        .where(and(eq(schema.accounts.userId, userId), eq(schema.automations.status, "live"), ne(schema.automations.id, id)));
      if (live >= limit) return true;
    }
    await tx.update(schema.automations).set({ name, trigger, commentReply, openingDm, emailCapture, followGate, finalDm, status: "live", liveAt: now, updatedAt: now }).where(eq(schema.automations.id, id));
    return false;
  });
  if (refused && limit !== null) {
    return { ok: false, reason: "limit", limit, upgradeUrl: upgradeUrl(), message: `You have ${limit} live automations, the most on Free. Pause one, or upgrade to Pro for unlimited live automations.` };
  }
  if (!wasLive) await alertWentLive(userId, { ...automation, ...content, trigger, status: "live" }, source);
  return { ok: true };
}

export async function pauseAutomation(userId: string, id: string): Promise<void> {
  await loadOwn(userId, id);
  await db().update(schema.automations).set({ status: "paused", updatedAt: new Date() }).where(eq(schema.automations.id, id));
}

export async function duplicateAutomation(userId: string, id: string): Promise<{ id: string }> {
  const { account, automation } = await loadOwn(userId, id);
  const { type, trigger, commentReply, openingDm, emailCapture, followGate, finalDm } = automation;
  const [row] = await db().insert(schema.automations).values({
    accountId: account.id,
    type,
    name: `${automation.name} (copy)`.slice(0, 80),
    trigger,
    commentReply,
    openingDm,
    emailCapture,
    followGate,
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

export type EarlierPreview = {
  /** People this send would message, at most `EARLIER_SEND_LIMIT`. */
  count: number;
  /** People who match in all, including any past the limit. */
  total: number;
  /** False when Adeli couldn't read every comment on the post, so there may be more. */
  complete: boolean;
  windowHours: number;
  /** Whether this user may send: Pro, or an install without billing. Free users still see the count, as a reason to upgrade. */
  allowed: boolean;
  upgradeUrl: string;
};

const EARLIER_PRO_MESSAGE = "Messaging earlier comments is on Pro. Upgrade to send this flow to people who commented before it went live.";

/**
 * The people Message earlier comments would reach on a live Comment to DM
 * automation for one post, and whether this user may send to them. `quick`
 * reads the post's comments once instead of waiting for Adeli to have them all.
 */
async function earlierComments(userId: string, id: string, quick = false): Promise<{ account: ConnectedAccount; found: EarlierComments; preview: EarlierPreview }> {
  const { account, automation } = await loadOwn(userId, id);
  if (automation.type !== "comment_to_dm") throw new ServiceError("Only Comment to DM automations can message earlier comments.");
  if (automation.status !== "live") throw new ServiceError("Go live first, then message earlier comments.");
  if (automation.trigger.postScope === "any") throw new ServiceError("This works on an automation for one post. Pick a post to message its earlier comments.");
  const found = await findEarlierComments(userId, account, id, { attempts: quick ? 1 : undefined });
  if (!found) throw new ServiceError("Your next post isn't up yet, so there are no earlier comments to message.");
  const { comments, complete } = found;
  const allowed = await getPlan(userId) !== "free";
  const preview = { count: Math.min(comments.length, EARLIER_SEND_LIMIT), total: comments.length, complete, windowHours: EARLIER_WINDOW_HOURS, allowed, upgradeUrl: upgradeUrl() };
  return { account, found, preview };
}

/**
 * How many people Message earlier comments would reach right now, on any
 * plan. Sends nothing. `quick` (the editor's check) reads Adeli once.
 */
export async function previewEarlierComments(userId: string, id: string, { quick = false } = {}): Promise<ActionResult<EarlierPreview>> {
  const { preview } = await earlierComments(userId, id, quick);
  return { ok: true, ...preview };
}

/**
 * Sends the flow to people who commented on the automation's post in the
 * last day, before it went live, up to `EARLIER_SEND_LIMIT` a time. Pro only
 * (any plan on an install without billing). The sending runs after the
 * response (`schedule`); `count` is how many it will try. Each person still
 * gets the flow only once, so sending again is safe.
 */
export async function messageEarlierComments(userId: string, id: string, schedule: (task: () => Promise<void>) => void = after): Promise<ActionResult<EarlierPreview>> {
  const { account, found, preview } = await earlierComments(userId, id);
  if (!preview.allowed) return { ok: false, reason: "pro", upgradeUrl: preview.upgradeUrl, message: EARLIER_PRO_MESSAGE };
  const batch = found.comments.slice(0, EARLIER_SEND_LIMIT);
  if (batch.length) {
    schedule(async () => {
      try {
        await sendEarlierComments(userId, account.accountId, found.automation, batch);
      } catch (error) {
        console.error(`Message earlier comments for ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
        trackError(error, userId, { automation_id: id });
      }
    });
  }
  return { ok: true, ...preview };
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
