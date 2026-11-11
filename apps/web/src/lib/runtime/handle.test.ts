import type { CommentCreatedEvent, MessageCreatedEvent, MessagePostbackEvent } from "@adeli/sdk/helpers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAutomationContent } from "@/lib/automations/defaults";
import { statsFor } from "@/lib/automations/stats";
import { db, schema } from "@/lib/db";

import { apiError, fakeAdeli } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedLiveAutomation, seedUser, TEST_KEY } from "../../../test/db-helpers";

import { findEmail, handleEvent } from "./handle";

let eventCount = 0;

function commentEvent(overrides: Partial<CommentCreatedEvent["data"]> = {}): CommentCreatedEvent {
  eventCount += 1;
  return {
    id: `evt_${eventCount}`,
    test: false,
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
    test: false,
    type: "message.postback",
    platform: "instagram",
    createdAt: new Date().toISOString(),
    profileId: "profile_1",
    accountId: "acc_1",
    data: { senderId: "ig_fan", payload, title: "Yes please", messageId: `mid_${eventCount}` },
  };
}

function messageEvent(text: string | null, senderId = "ig_fan", story: MessageCreatedEvent["data"]["story"] = null): MessageCreatedEvent {
  eventCount += 1;
  return {
    id: `evt_${eventCount}`,
    test: false,
    type: "message.created",
    platform: "instagram",
    createdAt: new Date().toISOString(),
    profileId: "profile_1",
    accountId: "acc_1",
    data: { messageId: `mid_${eventCount}`, conversationKey: `instagram:${senderId}`, from: { id: senderId, username: null }, text, attachments: [], replyTo: null, story, isEcho: false },
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

describe("story replies", () => {
  const STORY = { type: "reply" as const, id: "story_1", url: null };
  let storyAutomationId: string;

  beforeEach(async () => {
    const [account] = await db().select().from(schema.accounts);
    const { type, trigger, commentReply } = defaultAutomationContent(1, "story_reply");
    storyAutomationId = (await seedLiveAutomation(account.id, { type, name: "Story guide", trigger: { ...trigger, postScope: "any", keywords: ["guide"] }, commentReply })).id;
  });

  it("sends a specific-story automation only for replies to its story, ahead of Any story", async () => {
    const [account] = await db().select().from(schema.accounts);
    const { type, trigger, commentReply } = defaultAutomationContent(2, "story_reply");
    const picked = await seedLiveAutomation(account.id, { type, name: "This story", trigger: { ...trigger, mediaId: "story_1", keywords: ["guide"] }, commentReply });
    fakeAdeli();
    await handleEvent(USER, messageEvent("guide", "ig_fan", STORY));
    await handleEvent(USER, messageEvent("guide", "ig_other", { type: "reply", id: "story_2", url: null }));
    const runs = await db().select().from(schema.runs);
    expect(runs.find((run) => run.igUserId === "ig_fan")?.automationId).toBe(picked.id);
    expect(runs.find((run) => run.igUserId === "ig_other")?.automationId).toBe(storyAutomationId);
  });

  it("sends the opening DM straight to whoever replied, with no public reply", async () => {
    const adeli = fakeAdeli();
    const event = messageEvent("GUIDE please", "ig_fan", STORY);
    await handleEvent(USER, event);
    const run = await onlyRun();

    expect(adeli.comments()).toHaveLength(0);
    expect(adeli.messages()).toHaveLength(1);
    expect(adeli.messages()[0].body).toEqual({
      accountId: "acc_1",
      recipient: { id: "ig_fan" },
      text: "Hey there! Click below and I'll send you the link in a second.",
      buttons: [{ type: "postback", title: "Yes please", payload: run.id }],
    });
    expect(run).toMatchObject({ automationId: storyAutomationId, igUserId: "ig_fan", igSenderId: "ig_fan", commentId: event.data.messageId, commentText: "GUIDE please", state: "opening_sent", commentReplyState: "skipped" });
  });

  it("finishes the flow on a tap, like a comment run", async () => {
    fakeAdeli();
    await handleEvent(USER, messageEvent("guide", "ig_fan", STORY));
    const run = await onlyRun();
    const adeli = fakeAdeli();
    await handleEvent(USER, postbackEvent(run.id));
    expect(adeli.messages()[0].body).toMatchObject({ recipient: { id: "ig_fan" }, text: "Here it is!" });
    expect((await onlyRun()).state).toBe("final_sent");
  });

  it("sends the flow once per person and once per redelivery", async () => {
    const adeli = fakeAdeli();
    const event = messageEvent("guide", "ig_fan", STORY);
    await handleEvent(USER, event);
    await handleEvent(USER, event);
    await handleEvent(USER, messageEvent("guide again", "ig_fan", STORY));
    await onlyRun();
    expect(adeli.messages()).toHaveLength(1);
  });

  it("ignores plain DMs, story mentions, replies without the keyword, and our own replies", async () => {
    const adeli = fakeAdeli();
    await handleEvent(USER, messageEvent("guide"));
    await handleEvent(USER, messageEvent("guide", "ig_fan", { type: "mention", id: null, url: null }));
    await handleEvent(USER, messageEvent("so pretty", "ig_fan", STORY));
    await handleEvent(USER, messageEvent(null, "ig_fan", STORY));
    await handleEvent(USER, messageEvent("guide", "ig_self", STORY));
    expect(await db().select().from(schema.runs)).toHaveLength(0);
    expect(adeli.sent).toHaveLength(0);
  });

  it("matches any reply, even one with no text, when set to Any reply", async () => {
    const [row] = await db().select().from(schema.automations).where(eq(schema.automations.id, storyAutomationId));
    await db().update(schema.automations).set({ trigger: { ...row.trigger, match: "any" } }).where(eq(schema.automations.id, storyAutomationId));
    const adeli = fakeAdeli();
    await handleEvent(USER, messageEvent(null, "ig_fan", STORY));
    await onlyRun();
    expect(adeli.messages()).toHaveLength(1);
  });

  it("doesn't fire Comment to DM automations, or story automations on comments", async () => {
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent({ commentId: "c1" }));
    const run = await onlyRun();
    expect(run.automationId).toBe(automationId);
    expect(adeli.messages()[0].body).toMatchObject({ recipient: { commentId: "c1" } });
  });
});

describe("email capture", () => {
  const capture = { enabled: true, text: "Your email?", retryText: "Try again?" };

  async function tapped() {
    await db().update(schema.automations).set({ emailCapture: capture }).where(eq(schema.automations.id, automationId));
    fakeAdeli();
    await handleEvent(USER, commentEvent());
    const run = await onlyRun();
    const adeli = fakeAdeli();
    await handleEvent(USER, postbackEvent(run.id));
    return adeli;
  }

  it("asks for an email after the tap instead of sending the link", async () => {
    const adeli = await tapped();
    expect(adeli.messages()).toHaveLength(1);
    expect(adeli.messages()[0].body).toEqual({ accountId: "acc_1", recipient: { id: "ig_fan" }, text: "Your email?" });
    expect(await onlyRun()).toMatchObject({ state: "awaiting_email", igSenderId: "ig_fan" });
  });

  it("saves the lead and sends the Final DM once a valid email arrives, once", async () => {
    await tapped();
    const adeli = fakeAdeli();
    const reply = messageEvent("sure, it's Fan@Example.com thanks");
    await handleEvent(USER, reply);
    await handleEvent(USER, reply);
    expect(adeli.messages()).toHaveLength(1);
    expect(adeli.messages()[0].body).toMatchObject({ recipient: { id: "ig_fan" }, text: "Here it is!" });
    const leads = await db().select().from(schema.leads);
    expect(leads).toEqual([expect.objectContaining({ automationId, igUserId: "ig_fan", igUsername: "fan", email: "fan@example.com" })]);
    const run = await onlyRun();
    expect(run.state).toBe("final_sent");
    expect(run.emailAt).not.toBeNull();
    expect((await statsFor([automationId])).get(automationId)?.emails).toBe(1);
  });

  it("nudges once when the reply has no email, then waits", async () => {
    await tapped();
    const adeli = fakeAdeli();
    await handleEvent(USER, messageEvent("what?"));
    await handleEvent(USER, messageEvent("hello"));
    expect(adeli.messages().map((sent) => sent.body?.text)).toEqual(["Try again?"]);
    expect((await onlyRun()).state).toBe("awaiting_email");
    await handleEvent(USER, messageEvent("a@b.co"));
    expect((await onlyRun()).state).toBe("final_sent");
  });

  it("ignores DMs from people who aren't waiting on an email", async () => {
    await tapped();
    const adeli = fakeAdeli();
    await handleEvent(USER, messageEvent("x@y.com", "ig_stranger"));
    expect(adeli.sent).toHaveLength(0);
  });

  it("keeps leads when runs are reset", async () => {
    await tapped();
    fakeAdeli();
    await handleEvent(USER, messageEvent("fan@example.com"));
    await db().delete(schema.runs);
    expect(await db().select().from(schema.leads)).toHaveLength(1);
  });
});

describe("findEmail", () => {
  it("finds the first email in a message", () => {
    expect(findEmail("mine is A.B+c@mail.example.org!")).toBe("a.b+c@mail.example.org");
    expect(findEmail("no email here")).toBeNull();
    expect(findEmail(null)).toBeNull();
  });
});

describe("post scopes", () => {
  function posts(items: { id: string; publishedAt: string }[]) {
    return (sent: { method: string; path: string }) => sent.method === "GET" && sent.path === "/posts"
      ? { status: 200, body: { status: "complete", posts: items.map((item) => ({ id: item.id, providerId: item.id, platform: "instagram", caption: "", permalink: null, publishedAt: item.publishedAt, media: [{ type: "IMAGE", url: "https://example.com/a.jpg", thumbnailUrl: null }], engagement: { likes: 0, comments: 0 } })) } }
      : undefined;
  }

  it("binds a Next post automation to the first post after it went live, and saves it", async () => {
    const liveAt = new Date("2026-11-09T00:00:00.000Z");
    await db().update(schema.automations).set({ liveAt, trigger: { postScope: "next", mediaId: null, mediaSnapshot: null, match: "keywords", keywords: ["guide"] } }).where(eq(schema.automations.id, automationId));
    const adeli = fakeAdeli([posts([{ id: "media_new", publishedAt: "2026-11-09T10:00:00.000Z" }, { id: "media_old", publishedAt: "2026-11-01T10:00:00.000Z" }])]);
    await handleEvent(USER, commentEvent({ mediaId: "media_old" }));
    expect(await db().select().from(schema.runs)).toHaveLength(0);
    await handleEvent(USER, commentEvent({ mediaId: "media_new" }));
    expect(adeli.messages()).toHaveLength(1);
    const [row] = await db().select().from(schema.automations).where(eq(schema.automations.id, automationId));
    expect(row.trigger.mediaId).toBe("media_new");
  });

  it("answers comments on any post with an Any post automation", async () => {
    await db().update(schema.automations).set({ trigger: { postScope: "any", mediaId: null, mediaSnapshot: null, match: "keywords", keywords: ["guide"] } }).where(eq(schema.automations.id, automationId));
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent({ mediaId: "media_anything" }));
    expect(adeli.messages()).toHaveLength(1);
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
    expect(stats).toEqual({ triggered: 2, commentReplies: 2, openingDms: 2, buttonTaps: 1, emails: 0, finalDms: 1 });
  });
});

describe("separate users", () => {
  const OTHER = "user_2";

  it("only runs the automations of the user whose webhook received the comment", async () => {
    await seedUser(OTHER, { profileId: "profile_2" });
    const adeli = fakeAdeli();
    // user_2's webhook sees a comment on acc_1, which only user_1 has connected.
    await handleEvent(OTHER, commentEvent());
    expect(adeli.sent).toHaveLength(0);
    expect(await db().select().from(schema.runs)).toHaveLength(0);
  });

  it("uses the server's Adeli key for every user", async () => {
    await seedUser(OTHER, { profileId: "profile_2" });
    const otherAccount = await seedAccount(OTHER);
    await seedLiveAutomation(otherAccount.id);
    const adeli = fakeAdeli();
    await handleEvent(USER, commentEvent({ commentId: "c_shared" }));
    await handleEvent(OTHER, commentEvent({ commentId: "c_shared" }));
    const keys = adeli.sent.map((sent) => sent.authorization);
    expect(keys).toHaveLength(4);
    expect(keys.every((key) => key === `Bearer ${TEST_KEY}`)).toBe(true);
    // Same comment, two users' automations: one run each.
    expect(await db().select().from(schema.runs)).toHaveLength(2);
  });

  it("doesn't let another user's webhook claim a tap", async () => {
    await seedUser(OTHER, { profileId: "profile_2" });
    fakeAdeli();
    await handleEvent(USER, commentEvent());
    const run = await onlyRun();
    const adeli = fakeAdeli();
    await handleEvent(OTHER, postbackEvent(run.id));
    expect(adeli.sent).toHaveLength(0);
    expect((await onlyRun()).state).toBe("opening_sent");
  });
});
