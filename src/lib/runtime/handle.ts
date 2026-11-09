import "server-only";

import type { CommentCreatedEvent, MessagePostbackEvent, WebhookEvent } from "@adeli/sdk/helpers";
import { and, eq, inArray } from "drizzle-orm";

import { adeliCall } from "@/lib/adeli/client";
import { AdeliError } from "@/lib/adeli/types";
import { toAutomation } from "@/lib/data";
import { db, schema } from "@/lib/db";

import { matchComment } from "./match";

/**
 * The Comment to DM runtime (PRD §5.8), for one user: the one whose webhook
 * secret signed the delivery. It only reads that user's accounts and
 * automations and only calls Adeli with that user's key. Each step records
 * its outcome on the run. Nothing is retried: a failed step records the
 * error and stops.
 */
export async function handleEvent(userId: string, event: WebhookEvent) {
  if (event.type === "comment.created") return handleComment(userId, event);
  if (event.type === "message.postback") return handlePostback(userId, event);
}

function errorText(error: unknown) {
  if (error instanceof AdeliError) return `${error.code}: ${error.message}`.slice(0, 500);
  return error instanceof Error ? error.message.slice(0, 500) : "unknown error";
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

async function connectedAccount(userId: string, adeliAccountId: string) {
  const [account] = await db().select().from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.adeliAccountId, adeliAccountId), eq(schema.accounts.status, "connected")))
    .limit(1);
  return account ?? null;
}

async function handleComment(userId: string, event: CommentCreatedEvent) {
  const { data } = event;
  // Without the commenter's id there's no way to DM them or to send the flow only once (D3).
  if (!data.from.id) return;
  const account = await connectedAccount(userId, event.accountId);
  if (!account) return;

  const live = await db().select().from(schema.automations)
    .where(and(eq(schema.automations.accountId, account.id), eq(schema.automations.status, "live")));
  const automation = matchComment({ mediaId: data.mediaId, text: data.text, fromId: data.from.id, isSelf: data.isSelf }, account.igUserId, live.map((row) => toAutomation(row)));
  if (!automation) return;

  // The unique keys make this the dedupe: a repeat commenter or a redelivered comment inserts nothing.
  const [run] = await db().insert(schema.runs).values({
    automationId: automation.id,
    igUserId: data.from.id,
    igUsername: data.from.username,
    commentId: data.commentId,
    commentText: data.text,
  }).onConflictDoNothing().returning({ id: schema.runs.id });
  if (!run) return;

  const variants = automation.commentReply.variants.filter((variant) => variant.trim());
  if (automation.commentReply.enabled && variants.length) {
    try {
      await adeliCall(userId, (client) => client.comments.createComment({
        body: { platform: "instagram", accountId: account.adeliAccountId, parentId: data.commentId, message: pick(variants) },
      }));
      await updateRun(run.id, { commentReplyState: "sent" });
    } catch (error) {
      // A failed public reply doesn't stop the DM, which is the part people asked for.
      await updateRun(run.id, { commentReplyState: "failed", error: errorText(error) });
    }
  } else {
    await updateRun(run.id, { commentReplyState: "skipped" });
  }

  try {
    await adeliCall(userId, (client) => client.messages.sendInstagramMessage({
      body: {
        accountId: account.adeliAccountId,
        recipient: { commentId: data.commentId },
        text: automation.openingDm.text,
        buttons: [{ type: "postback", title: automation.openingDm.buttonLabel, payload: run.id }],
      },
    }));
    await updateRun(run.id, { state: "opening_sent", openingSentAt: new Date() });
  } catch (error) {
    await updateRun(run.id, { state: "failed", error: errorText(error) });
  }
}

async function handlePostback(userId: string, event: MessagePostbackEvent) {
  const now = new Date();
  // Only this user's runs. Another user's webhook can see the same tap when both use the same Adeli profile.
  const ownAutomations = db().select({ id: schema.automations.id }).from(schema.automations)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.automations.accountId))
    .where(eq(schema.accounts.userId, userId));
  // The claim: Postgres serializes this update, so only one delivery of a tap gets the row back.
  const [run] = await db().update(schema.runs)
    .set({ state: "final_sending", tappedAt: now, updatedAt: now })
    .where(and(eq(schema.runs.id, event.data.payload), eq(schema.runs.state, "opening_sent"), inArray(schema.runs.automationId, ownAutomations)))
    .returning({ id: schema.runs.id, automationId: schema.runs.automationId });
  if (!run) return;

  // Always the automation's current content. A paused automation still finishes taps it started.
  const [row] = await db().select({ automation: schema.automations, account: schema.accounts })
    .from(schema.automations)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.automations.accountId))
    .where(eq(schema.automations.id, run.automationId))
    .limit(1);
  if (!row || row.account.adeliAccountId !== event.accountId) {
    await updateRun(run.id, { state: "failed", error: "The tap came from a different Instagram account." });
    return;
  }

  const { finalDm } = row.automation;
  try {
    await adeliCall(userId, (client) => client.messages.sendInstagramMessage({
      body: {
        accountId: row.account.adeliAccountId,
        recipient: { id: event.data.senderId },
        text: finalDm.text,
        buttons: finalDm.buttons.map((button) => ({ type: "url" as const, title: button.label, url: button.url })),
      },
    }));
    await updateRun(run.id, { state: "final_sent" });
  } catch (error) {
    await updateRun(run.id, { state: "failed", error: errorText(error) });
  }
}

async function updateRun(id: string, values: Partial<typeof schema.runs.$inferInsert>) {
  await db().update(schema.runs).set({ ...values, updatedAt: new Date() }).where(eq(schema.runs.id, id));
}
