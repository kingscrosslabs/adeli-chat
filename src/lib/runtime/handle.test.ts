import type { CommentCreatedEvent, MessagePostbackEvent } from "@adeli/sdk/helpers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { statsFor } from "@/lib/automations/stats";
import { db, schema } from "@/lib/db";

import { apiError, fakeAdeli } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedLiveAutomation, seedUser, TEST_KEY as TEST_KEY_1 } from "../../../test/db-helpers";

import { handleEvent } from "./handle";

let eventCount = 0;

function commentEvent(overrides: Partial<CommentCreatedEvent["data"]> = {}): CommentCreatedEvent {
  eventCount += 1;
  return {
    id: `evt_${eventCount}`,
    type: "comment.created",
    platform: "instagram",
    createdAt: new Date().toISOString(),
    profileId: "profile_1",
    accountId: "acc_1",
    data: { commentId: `comment_${eventCount}`, mediaId: "media_1", parentId: null, text: "Guide please", from: { id: "ig_fan", username: "fan" }, isSelf: false, ...overrides },
  };
}

function postbackEvent(payload: string): MessagePostbackEvent {
  eventCount += 1;
  return {
    id: `evt_${eventCount}`,
    type: "message.postback",
    platform: "instagram",
    createdAt: new Date().toISOString(),
    profileId: "profile_1",
    accountId: "acc_1",
    data: { senderId: "ig_fan", payload, title: "Yes please", messageId: `mid_${eventCount}` },
  };
}

async function onlyRun() {
  const runs = await db().select().from(schema.runs);
  expect(runs).toHaveLength(1);
  return runs[0];
}

const USER = "user_1";
let automationId: string;

beforeEach(async () => {
  await resetDatabase();
  await seedUser(USER);
  const account = await seedAccount(USER);
  automationId = (await seedLiveAutomation(account.id)).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("comment.created", () => {
  it("replies publicly, then sends the opening DM with the run id as the postback payload", async () => {
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent({ commentId: "c1" }));
    const run = await onlyRun();

    expect(adeli.comments()).toHaveLength(1);
    expect(adeli.comments()[0].body).toMatchObject({ platform: "instagram", accountId: "acc_1", parentId: "c1" });
    expect(adeli.messages()).toHaveLength(1);
    expect(adeli.messages()[0].body).toEqual({
      accountId: "acc_1",
      recipient: { commentId: "c1" },
      text: "Hey there! Click below and I'll send you the link in a second.",
      buttons: [{ type: "postback", title: "Yes please", payload: run.id }],
    });
    expect(run).toMatchObject({ igUserId: "ig_fan", igUsername: "fan", commentId: "c1", state: "opening_sent", commentReplyState: "sent" });
    expect(run.openingSentAt).not.toBeNull();
  });

  it("skips a repeat commenter", async () => {
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent());
    await handleEvent(USER, commentEvent({ text: "guide again" }));
    await onlyRun();
    expect(adeli.messages()).toHaveLength(1);
  });

  it("sends nothing for a redelivered event", async () => {
    const adeli = fakeAdeli();
    const event = commentEvent();
    await handleEvent(USER, event);
    await handleEvent(USER, event);
    await onlyRun();
    expect(adeli.messages()).toHaveLength(1);
    expect(adeli.comments()).toHaveLength(1);
  });

  it("ignores self-comments and comments without the keyword", async () => {
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent({ isSelf: true }));
    await handleEvent(USER, commentEvent({ text: "love it", from: { id: "ig_other", username: "other" } }));
    expect(await db().select().from(schema.runs)).toHaveLength(0);
    expect(adeli.sent).toHaveLength(0);
  });

  it("creates no runs for a paused automation", async () => {
    const adeli = fakeAdeli();
    await db().update(schema.automations).set({ status: "paused" }).where(eq(schema.automations.id, automationId));
    await handleEvent(USER, commentEvent());
    expect(await db().select().from(schema.runs)).toHaveLength(0);
    expect(adeli.sent).toHaveLength(0);
  });

  it("still sends the opening DM when the public reply fails, and records an opening DM failure", async () => {
    fakeAdeli([(sent) => sent.path === "/comments" ? apiError(403, "permission_required") : undefined]);
    await handleEvent(USER, commentEvent());
    expect(await onlyRun()).toMatchObject({ commentReplyState: "failed", state: "opening_sent" });

    await resetDatabase();
    await seedUser(USER);
    const account = await seedAccount(USER);
    await seedLiveAutomation(account.id);
    fakeAdeli([(sent) => sent.path === "/messages/instagram" ? apiError(409, "private_reply_already_sent") : undefined]);
    await handleEvent(USER, commentEvent());
    const run = await onlyRun();
    expect(run.state).toBe("failed");
    expect(run.error).toContain("private_reply_already_sent");
  });
});

describe("message.postback", () => {
  async function openRun() {
    fakeAdeli();
    await handleEvent(USER, commentEvent());
    return onlyRun();
  }

  it("sends the Final DM with URL buttons once, even when two taps arrive together", async () => {
    const run = await openRun();
    // A slow send keeps the first tap mid-flight while the second one tries to claim the run.
    const adeli = fakeAdeli([], { delayMs: 200 });
    await Promise.all([handleEvent(USER, postbackEvent(run.id)), handleEvent(USER, postbackEvent(run.id))]);
    await handleEvent(USER, postbackEvent(run.id));

    expect(adeli.messages()).toHaveLength(1);
    expect(adeli.messages()[0].body).toEqual({
      accountId: "acc_1",
      recipient: { id: "ig_fan" },
      text: "Here it is!",
      buttons: [{ type: "url", title: "Get it", url: "https://example.com/guide" }],
    });
    const done = await onlyRun();
    expect(done.state).toBe("final_sent");
    expect(done.tappedAt).not.toBeNull();
  });

  it("finishes a tap after the automation is paused, with its current content", async () => {
    const run = await openRun();
    await db().update(schema.automations).set({
      status: "paused",
      finalDm: { type: "text_buttons", text: "Updated link", buttons: [{ label: "New", url: "https://example.com/new" }] },
    }).where(eq(schema.automations.id, automationId));
    const adeli = fakeAdeli();
    await handleEvent(USER, postbackEvent(run.id));
    expect(adeli.messages()[0].body).toMatchObject({ text: "Updated link" });
    expect((await onlyRun()).state).toBe("final_sent");
  });

  it("records window_closed on the run and doesn't retry", async () => {
    const run = await openRun();
    const adeli = fakeAdeli([(sent) => sent.path === "/messages/instagram" ? apiError(409, "window_closed") : undefined]);
    await handleEvent(USER, postbackEvent(run.id));
    await handleEvent(USER, postbackEvent(run.id));
    expect(adeli.messages()).toHaveLength(1);
    const failed = await onlyRun();
    expect(failed.state).toBe("failed");
    expect(failed.error).toContain("window_closed");
  });

  it("ignores payloads that aren't one of our runs", async () => {
    await openRun();
    const adeli = fakeAdeli();
    await handleEvent(USER, postbackEvent("not-a-run"));
    expect(adeli.sent).toHaveLength(0);
  });
});

describe("stats", () => {
  it("counts each step from runs", async () => {
    fakeAdeli();
    await handleEvent(USER, commentEvent({ from: { id: "ig_a", username: "a" } }));
    await handleEvent(USER, commentEvent({ from: { id: "ig_b", username: "b" } }));
    const [first] = await db().select().from(schema.runs).where(eq(schema.runs.igUserId, "ig_a"));
    await handleEvent(USER, postbackEvent(first.id));
    const stats = (await statsFor([automationId])).get(automationId);
    expect(stats).toEqual({ triggered: 2, commentReplies: 2, openingDms: 2, buttonTaps: 1, finalDms: 1 });
  });
});

describe("separate users", () => {
  const OTHER = "user_2";
  const OTHER_KEY = `rk_live_${"b".repeat(43)}`;

  it("only runs the automations of the user whose webhook received the comment", async () => {
    await seedUser(OTHER, OTHER_KEY);
    const adeli = fakeAdeli();
    // user_2's webhook sees a comment on acc_1, which only user_1 has connected.
    await handleEvent(OTHER, commentEvent());
    expect(adeli.sent).toHaveLength(0);
    expect(await db().select().from(schema.runs)).toHaveLength(0);
  });

  it("uses each user's own Adeli key", async () => {
    await seedUser(OTHER, OTHER_KEY);
    const otherAccount = await seedAccount(OTHER);
    await seedLiveAutomation(otherAccount.id);
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent({ commentId: "c_shared" }));
    await handleEvent(OTHER, commentEvent({ commentId: "c_shared" }));
    const keys = adeli.sent.map((sent) => sent.authorization);
    expect(keys.filter((key) => key === `Bearer ${TEST_KEY_1}`)).toHaveLength(2);
    expect(keys.filter((key) => key === `Bearer ${OTHER_KEY}`)).toHaveLength(2);
    // Same comment, two users' automations: one run each.
    expect(await db().select().from(schema.runs)).toHaveLength(2);
  });

  it("doesn't let another user's webhook claim a tap", async () => {
    await seedUser(OTHER, OTHER_KEY);
    fakeAdeli();
    await handleEvent(USER, commentEvent());
    const run = await onlyRun();
    const adeli = fakeAdeli();
    await handleEvent(OTHER, postbackEvent(run.id));
    expect(adeli.sent).toHaveLength(0);
    expect((await onlyRun()).state).toBe("opening_sent");
  });
});
