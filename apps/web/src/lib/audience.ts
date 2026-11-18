import "server-only";

import { and, asc, count, desc, eq, inArray, max, min, sql } from "drizzle-orm";

import { STAGE_LABELS, type RunStage } from "@/lib/audience-stages";
import { db, schema } from "@/lib/db";

export { STAGE_LABELS, type RunStage };

/**
 * Audience: everyone who triggered one of the account's automations, grouped
 * by Instagram user id. Read straight from `runs` and `leads`, so Reset runs
 * removes people from it (their emails stay in `leads`). Every function takes
 * the signed-in user's own account id; an automation id from the browser is
 * only used together with it.
 */

export type AudienceContact = {
  igUserId: string;
  igUsername: string | null;
  /** How many of the account's automations they triggered. */
  automations: number;
  buttonTaps: number;
  finalDms: number;
  email: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

/** One person in one automation (the per-automation People list). */
export type AutomationPerson = {
  igUserId: string;
  igUsername: string | null;
  stage: RunStage;
  commentText: string | null;
  source: "live" | "earlier";
  email: string | null;
  triggeredAt: string;
};

/** One automation a person triggered, for their contact detail. */
export type ContactRun = AutomationPerson & { automationId: string; automationName: string; automationType: "comment_to_dm" | "story_reply" };

/** The most people one Audience read returns, most engaged first. */
export const AUDIENCE_LIMIT = 2000;

export function stageOf(state: typeof schema.runs.$inferSelect.state): RunStage {
  return state === "final_sending" ? "tapped" : state;
}

/** The account's automation ids, or only `automationId` when it's one of them. */
async function ownAutomationIds(accountId: string, automationId?: string): Promise<string[]> {
  const { automations } = schema;
  const rows = await db().select({ id: automations.id }).from(automations)
    .where(automationId ? and(eq(automations.accountId, accountId), eq(automations.id, automationId)) : eq(automations.accountId, accountId));
  return rows.map((row) => row.id);
}

/** Latest email per person (and per automation), from `leads`. */
async function emailsFor(automationIds: string[], igUserIds?: string[]) {
  const { leads } = schema;
  const rows = await db().select({ automationId: leads.automationId, igUserId: leads.igUserId, email: leads.email }).from(leads)
    .where(igUserIds ? and(inArray(leads.automationId, automationIds), inArray(leads.igUserId, igUserIds)) : inArray(leads.automationId, automationIds))
    .orderBy(asc(leads.updatedAt));
  const byPerson = new Map<string, string>();
  const byRun = new Map<string, string>();
  // Ascending, so the last write is the newest email.
  for (const row of rows) {
    byPerson.set(row.igUserId, row.email);
    byRun.set(`${row.automationId}:${row.igUserId}`, row.email);
  }
  return { byPerson, byRun };
}

/** Everyone across the account's automations, most engaged first (most automations, then Final DMs, then most recent). */
export async function listAudience(accountId: string): Promise<AudienceContact[]> {
  const ids = await ownAutomationIds(accountId);
  if (!ids.length) return [];
  const { runs } = schema;
  const lastSeen = max(runs.createdAt);
  const automationCount = sql<number>`count(distinct ${runs.automationId})`.mapWith(Number);
  const finalDms = count(sql`case when ${runs.state} = 'final_sent' then 1 end`);
  const rows = await db().select({
    igUserId: runs.igUserId,
    // Their handle from their latest run that has one: handles can change.
    igUsername: sql<string | null>`(array_agg(${runs.igUsername} order by ${runs.createdAt} desc) filter (where ${runs.igUsername} is not null))[1]`,
    automations: automationCount,
    buttonTaps: count(runs.tappedAt),
    finalDms,
    firstSeenAt: min(runs.createdAt),
    lastSeenAt: lastSeen,
  }).from(runs)
    .where(inArray(runs.automationId, ids))
    .groupBy(runs.igUserId)
    .orderBy(desc(automationCount), desc(finalDms), desc(lastSeen))
    .limit(AUDIENCE_LIMIT);
  const { byPerson } = await emailsFor(ids, rows.map((row) => row.igUserId));
  return rows.map((row) => ({
    igUserId: row.igUserId,
    igUsername: row.igUsername,
    automations: row.automations,
    buttonTaps: row.buttonTaps,
    finalDms: row.finalDms,
    email: byPerson.get(row.igUserId) ?? null,
    firstSeenAt: toIso(row.firstSeenAt),
    lastSeenAt: toIso(row.lastSeenAt),
  }));
}

/** Everyone who triggered one automation, newest first. Empty when it isn't the account's. */
export async function listAutomationPeople(accountId: string, automationId: string): Promise<AutomationPerson[]> {
  const ids = await ownAutomationIds(accountId, automationId);
  if (!ids.length) return [];
  const { runs } = schema;
  const rows = await db().select().from(runs).where(eq(runs.automationId, automationId)).orderBy(desc(runs.createdAt)).limit(AUDIENCE_LIMIT);
  const { byRun } = await emailsFor(ids, rows.map((row) => row.igUserId));
  return rows.map((row) => ({
    igUserId: row.igUserId,
    igUsername: row.igUsername,
    stage: stageOf(row.state),
    commentText: row.commentText,
    source: row.source,
    email: byRun.get(`${automationId}:${row.igUserId}`) ?? null,
    triggeredAt: row.createdAt.toISOString(),
  }));
}

/** Every automation one person triggered on the account, newest first. */
export async function listContactRuns(accountId: string, igUserId: string): Promise<ContactRun[]> {
  const { runs, automations } = schema;
  const rows = await db().select({ run: runs, automationName: automations.name, automationType: automations.type }).from(runs)
    .innerJoin(automations, eq(automations.id, runs.automationId))
    .where(and(eq(automations.accountId, accountId), eq(runs.igUserId, igUserId)))
    .orderBy(desc(runs.createdAt));
  if (!rows.length) return [];
  const { byRun } = await emailsFor(rows.map((row) => row.run.automationId), [igUserId]);
  return rows.map(({ run, automationName, automationType }) => ({
    automationId: run.automationId,
    automationName,
    automationType,
    igUserId: run.igUserId,
    igUsername: run.igUsername,
    stage: stageOf(run.state),
    commentText: run.commentText,
    source: run.source,
    email: byRun.get(`${run.automationId}:${igUserId}`) ?? null,
    triggeredAt: run.createdAt.toISOString(),
  }));
}

function toIso(value: Date | string | null) {
  if (!value) return new Date(0).toISOString();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** RFC 4180 quoting, plus a leading quote on anything a spreadsheet would run as a formula. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csv(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function audienceCsv(contacts: AudienceContact[]) {
  return csv([
    ["Instagram username", "Instagram user id", "Automations triggered", "Button taps", "Final DMs", "Email", "First seen", "Last seen"],
    ...contacts.map((contact) => [contact.igUsername ?? "", contact.igUserId, String(contact.automations), String(contact.buttonTaps), String(contact.finalDms), contact.email ?? "", contact.firstSeenAt, contact.lastSeenAt]),
  ]);
}

export function automationPeopleCsv(people: AutomationPerson[]) {
  return csv([
    ["Instagram username", "Instagram user id", "Stage", "Comment", "Source", "Email", "Triggered at"],
    ...people.map((person) => [person.igUsername ?? "", person.igUserId, STAGE_LABELS[person.stage], person.commentText ?? "", person.source, person.email ?? "", person.triggeredAt]),
  ]);
}
