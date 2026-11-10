import "server-only";

import type { CommentCreatedEvent, MessageCreatedEvent, MessagePostbackEvent, WebhookEvent } from "@adeli/sdk/helpers";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { adeliCall } from "@/lib/adeli/client";
import { listMedia } from "@/lib/adeli/instagram";
import { AdeliError } from "@/lib/adeli/types";
import { emailCaptureOf, type Automation } from "@/lib/automations/schemas";
import { snapshotOf } from "@/lib/automations/snapshot";
import { toAutomation } from "@/lib/data";
import { db, schema } from "@/lib/db";

import { matchComment, nextPostAfter } from "./match";

/**
 * The Comment to DM runtime (PRD §5.8), for one user: the one whose webhook
 * secret signed the delivery. It only reads that user's accounts and
 * automations and only calls Adeli with that user's key. Each step records
 * its outcome on the run. Nothing is retried: a failed step records the
 * error and stops.
 */
export async function handleEvent(userId: string, event: WebhookEvent) {
  if (event.type === "comment.created" && event.platform === "instagram") return handleComment(userId, event);
  if (event.type === "message.postback") return handlePostback(userId, event);
  if (event.type === "message.created" && event.platform === "instagram") return handleMessage(userId, event);
}

/** The first email address in a message, lowercased, or null. */
export function findEmail(text: string | null) {
  const match = text?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
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

  const rows = await db().select().from(schema.automations)
    .where(and(eq(schema.automations.accountId, account.id), eq(schema.automations.status, "live")));
  const live = await bindNextPosts(userId, account.adeliAccountId, rows.map((row) => toAutomation(row)));
  const automation = matchComment({ mediaId: data.mediaId, text: data.text, fromId: data.from.id, isSelf: data.isSelf }, account.igUserId, live);
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
    .set({ state: "final_sending", tappedAt: now, igSenderId: event.data.senderId, updatedAt: now })
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

  const emailCapture = emailCaptureOf(toAutomation(row.automation));
  if (emailCapture.enabled) {
    try {
      await sendText(userId, row.account.adeliAccountId, event.data.senderId, emailCapture.text);
      await updateRun(run.id, { state: "awaiting_email" });
    } catch (error) {
      await updateRun(run.id, { state: "failed", error: errorText(error) });
    }
    return;
  }
  await sendFinalDm(userId, run.id, row.account.adeliAccountId, event.data.senderId, row.automation.finalDm);
}

/**
 * A DM someone sent us. If they owe an automation an email, this is their
 * answer: a valid email is saved as a lead and unlocks the Final DM;
 * anything else gets the retry message once. Other DMs are ignored.
 */
async function handleMessage(userId: string, event: MessageCreatedEvent) {
  const senderId = event.data.from.id;
  const account = await connectedAccount(userId, event.accountId);
  if (!account) return;
  // Their most recent tap still waiting on an email, on this user's account.
  const [waiting] = await db().select({ run: schema.runs, automation: schema.automations })
    .from(schema.runs)
    .innerJoin(schema.automations, eq(schema.automations.id, schema.runs.automationId))
    .where(and(eq(schema.runs.igSenderId, senderId), eq(schema.runs.state, "awaiting_email"), eq(schema.automations.accountId, account.id)))
    .orderBy(desc(schema.runs.tappedAt))
    .limit(1);
  if (!waiting) return;

  const email = findEmail(event.data.text);
  if (!email) {
    // Claim the one retry, so a redelivered message can't nudge twice.
    const [claimed] = await db().update(schema.runs).set({ emailRetriedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.runs.id, waiting.run.id), isNull(schema.runs.emailRetriedAt)))
      .returning({ id: schema.runs.id });
    if (!claimed) return;
    const { retryText } = emailCaptureOf(toAutomation(waiting.automation));
    await sendText(userId, account.adeliAccountId, senderId, retryText).catch(async (error) => updateRun(waiting.run.id, { error: errorText(error) }));
    return;
  }

  // The same claim as a tap: only one delivery of their reply moves the run on.
  const now = new Date();
  const [run] = await db().update(schema.runs)
    .set({ state: "final_sending", emailAt: now, updatedAt: now })
    .where(and(eq(schema.runs.id, waiting.run.id), eq(schema.runs.state, "awaiting_email")))
    .returning({ id: schema.runs.id });
  if (!run) return;
  await db().insert(schema.leads)
    .values({ automationId: waiting.automation.id, igUserId: waiting.run.igUserId, igUsername: waiting.run.igUsername, email })
    .onConflictDoUpdate({ target: [schema.leads.automationId, schema.leads.igUserId], set: { email, updatedAt: now } });
  await sendFinalDm(userId, run.id, account.adeliAccountId, senderId, waiting.automation.finalDm);
}

/**
 * Next post automations that don't have their post yet get it here, once
 * one is published after they went live. The binding is saved, so from then
 * on they watch that post like any other.
 */
async function bindNextPosts(userId: string, adeliAccountId: string, live: Automation[]): Promise<Automation[]> {
  const waiting = live.filter((automation) => automation.trigger.postScope === "next" && !automation.trigger.mediaId);
  if (!waiting.length) return live;
  let media;
  try {
    ({ media } = await listMedia(userId, adeliAccountId, 0));
  } catch {
    return live;
  }
  return Promise.all(live.map(async (automation) => {
    if (!waiting.includes(automation)) return automation;
    const post = nextPostAfter(media, automation.liveAt);
    if (!post) return automation;
    const trigger = { ...automation.trigger, mediaId: post.id, mediaSnapshot: snapshotOf(post) };
    // Only while it's still waiting, so two comments arriving together bind it once.
    await db().update(schema.automations).set({ trigger, updatedAt: new Date() })
      .where(and(eq(schema.automations.id, automation.id), sql`${schema.automations.trigger}->>'mediaId' is null`));
    return { ...automation, trigger };
  }));
}

async function sendText(userId: string, adeliAccountId: string, recipientId: string, text: string) {
  await adeliCall(userId, (client) => client.messages.sendInstagramMessage({ body: { accountId: adeliAccountId, recipient: { id: recipientId }, text } }));
}

async function sendFinalDm(userId: string, runId: string, adeliAccountId: string, recipientId: string, finalDm: Automation["finalDm"]) {
  try {
    await adeliCall(userId, (client) => client.messages.sendInstagramMessage({
      body: {
        accountId: adeliAccountId,
        recipient: { id: recipientId },
        text: finalDm.text,
        buttons: finalDm.buttons.map((button) => ({ type: "url" as const, title: button.label, url: button.url })),
      },
    }));
    await updateRun(runId, { state: "final_sent" });
  } catch (error) {
    await updateRun(runId, { state: "failed", error: errorText(error) });
  }
}

async function updateRun(id: string, values: Partial<typeof schema.runs.$inferInsert>) {
  await db().update(schema.runs).set({ ...values, updatedAt: new Date() }).where(eq(schema.runs.id, id));
}
