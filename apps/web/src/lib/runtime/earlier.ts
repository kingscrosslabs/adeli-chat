import "server-only";

import { eq } from "drizzle-orm";

import { listPostComments } from "@/lib/adeli/instagram";
import type { ConnectedAccount } from "@/lib/data";
import { db, schema } from "@/lib/db";
import type { Automation } from "@adeli-chat/ui/automation/schemas";

import { bindNextPosts, liveAutomations, startCommentRun, type CommentToRun } from "./handle";
import { matchComment } from "./match";

/** How far back Message earlier comments looks. Meta allows a private reply up to 7 days after a comment; we keep to a day. */
export const EARLIER_WINDOW_HOURS = 24;

/** The most people one send messages, so it finishes within a request's time. Sending again picks up the rest. */
export const EARLIER_SEND_LIMIT = 100;

export type EarlierComments = {
  /** The automation as it is now, with a Next post automation bound to its post when there is one. */
  automation: Automation;
  /** Oldest first, one per person. */
  comments: CommentToRun[];
  /** False when Adeli couldn't read every comment on the post in time. */
  complete: boolean;
};

/**
 * The comments from the last day on a live automation's post that it would
 * have answered had it been live then. They match by the same rules as a live
 * comment, against every live automation, so a post's own automation still
 * wins over a Next post one. The account's own comments are left out, so
 * is anyone who already has a run on it (D3), and so is any comment another
 * automation already answered. Each person counts once, for
 * their earliest comment. Null when the automation isn't live or has no post.
 */
export async function findEarlierComments(userId: string, account: ConnectedAccount, automationId: string, { now = new Date(), attempts }: { now?: Date; attempts?: number } = {}): Promise<EarlierComments | null> {
  const live = await bindNextPosts(userId, account.accountId, await liveAutomations(account.id));
  const automation = live.find((item) => item.id === automationId);
  const mediaId = automation?.trigger.mediaId;
  if (!automation || automation.type !== "comment_to_dm" || automation.trigger.postScope === "any" || !mediaId) return null;

  const { comments, complete } = await listPostComments(userId, account.accountId, mediaId, { attempts });
  const since = now.getTime() - EARLIER_WINDOW_HOURS * 60 * 60 * 1000;
  // People this automation already messaged (D3), and comments any of the account's automations already answered:
  // Instagram allows one private reply per comment, so a second Opening DM to it would only fail.
  const runs = await db().select({ automationId: schema.runs.automationId, igUserId: schema.runs.igUserId, commentId: schema.runs.commentId })
    .from(schema.runs)
    .innerJoin(schema.automations, eq(schema.automations.id, schema.runs.automationId))
    .where(eq(schema.automations.accountId, account.id));
  const done = new Set(runs.flatMap((run) => run.automationId === automation.id ? [run.igUserId, run.commentId] : [run.commentId]));

  const people = new Map<string, CommentToRun>();
  const oldestFirst = [...comments].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const comment of oldestFirst) {
    const fromId = comment.authorId;
    // Without the commenter's id there's no way to send the flow only once.
    if (!fromId || people.has(fromId) || done.has(fromId) || done.has(comment.id)) continue;
    if (Date.parse(comment.createdAt) < since) continue;
    const matched = matchComment({ mediaId, text: comment.body, fromId, isSelf: comment.isCreator }, account.providerId || null, live);
    if (matched?.id !== automation.id) continue;
    people.set(fromId, { commentId: comment.id, text: comment.body, fromId, fromUsername: comment.authorHandle || null });
  }
  return { automation, comments: [...people.values()], complete };
}

/**
 * Starts the flow for each comment, one at a time, exactly as for a live
 * comment. Someone who commented again live in the meantime already has a run,
 * so they're skipped. Returns how many runs started.
 */
export async function sendEarlierComments(userId: string, adeliAccountId: string, automation: Automation, comments: CommentToRun[]) {
  let started = 0;
  for (const comment of comments) {
    if (await startCommentRun(userId, adeliAccountId, automation, comment, "earlier")) started += 1;
  }
  return started;
}
