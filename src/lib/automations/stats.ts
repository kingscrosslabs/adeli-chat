import "server-only";

import { count, inArray, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";

import type { AutomationStats } from "./schemas";

export const NO_STATS: AutomationStats = { triggered: 0, commentReplies: 0, openingDms: 0, buttonTaps: 0, finalDms: 0 };

/** FR-10.1 counts per automation, from `runs`. */
export async function statsFor(automationIds: string[]): Promise<Map<string, AutomationStats>> {
  const stats = new Map<string, AutomationStats>();
  if (!automationIds.length) return stats;
  const { runs } = schema;
  const rows = await db().select({
    automationId: runs.automationId,
    triggered: count(),
    commentReplies: count(sql`case when ${runs.commentReplyState} = 'sent' then 1 end`),
    openingDms: count(runs.openingSentAt),
    buttonTaps: count(runs.tappedAt),
    finalDms: count(sql`case when ${runs.state} = 'final_sent' then 1 end`),
  }).from(runs).where(inArray(runs.automationId, automationIds)).groupBy(runs.automationId);
  for (const { automationId, ...counts } of rows) stats.set(automationId, counts);
  return stats;
}

