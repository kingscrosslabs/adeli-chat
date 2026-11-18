import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAutomationContent } from "@adeli-chat/ui/automation/defaults";
import { listPostComments } from "@/lib/adeli/instagram";
import { messageEarlierComments, previewEarlierComments, ServiceError } from "@/lib/automations/service";
import { db, schema } from "@/lib/db";

import { fakeAdeli, type Sent } from "../../../test/fake-adeli";
import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../../test/db-helpers";

const USER = "user_1";
let accountId: string;
let automationId: string;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

type FakeComment = { id: string; authorId?: string | null; body?: string; hours?: number; isCreator?: boolean; parentId?: string | null };

function comment({ id, authorId = `ig_${id}`, body = "Guide please", hours = 1, isCreator = false, parentId = null }: FakeComment) {
  return { id, mediaId: "media_1", parentId, authorId, authorName: authorId ?? "", authorFullName: null, authorHandle: authorId ?? "", avatarUrl: null, profileUrl: null, body, likeCount: 0, isCreator, isHidden: false, createdAt: hoursAgo(hours) };
}

/** The post's comments on GET /comments, `complete` per read in turn (the last one repeats). */
function commentsRoute(comments: FakeComment[], complete: boolean[] = [true]) {
  let reads = 0;
  return (sent: Sent) => {
    if (sent.path !== "/comments" || sent.method !== "GET") return undefined;
    const done = complete[Math.min(reads, complete.length - 1)];
    reads += 1;
    return { status: 200, body: { platform: "instagram", accountId: "acc_1", profileId: "profile_1", postId: sent.query.get("postId"), posts: [], comments: comments.map(comment), nextCursor: null, complete: done, syncedAt: new Date().toISOString() } };
  };
}

/** Runs the scheduled send now, so the test can see what it did. */
async function sendNow(id = automationId) {
  const tasks: Array<() => Promise<void>> = [];
  const result = await messageEarlierComments(USER, id, (task) => tasks.push(task));
  for (const task of tasks) await task();
  return result;
}

const openingDms = (sent: Sent[]) => sent.filter((item) => item.path === "/messages/instagram" && item.body && "commentId" in (item.body.recipient as object));

beforeEach(async () => {
  vi.stubEnv("LEDACHAT_BRANDING", "off");
  await resetDatabase();
  await seedUser(USER);
  accountId = (await seedAccount(USER)).id;
  automationId = (await seedLiveAutomation(accountId)).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Message earlier comments", () => {
  it("counts matching comments from the last 24 hours, once per person", async () => {
    const adeli = fakeAdeli([commentsRoute([
      { id: "c1", authorId: "ig_ana" },
      { id: "c2", authorId: "ig_ana", body: "guide again" },
      { id: "c3", authorId: "ig_ben", body: "GUIDE" },
      { id: "c4", authorId: "ig_old", hours: 30 },
      { id: "c5", authorId: "ig_other", body: "nice post" },
      { id: "c6", authorId: "ig_self", isCreator: true },
      { id: "c7", authorId: null },
    ])]);

    const preview = await previewEarlierComments(USER, automationId);

    expect(preview).toMatchObject({ ok: true, count: 2, total: 2, complete: true, windowHours: 24, allowed: true });
    expect(adeli.sent.find((item) => item.path === "/comments")?.query.get("postId")).toBe("media_1");
    expect(openingDms(adeli.sent)).toHaveLength(0);
  });

  it("sends each person the flow once, as a private reply to their earliest comment", async () => {
    const adeli = fakeAdeli([commentsRoute([
      { id: "c2", authorId: "ig_ana", hours: 1 },
      { id: "c1", authorId: "ig_ana", hours: 3 },
      { id: "c3", authorId: "ig_ben", hours: 2 },
    ])]);

    const result = await sendNow();

    expect(result).toMatchObject({ ok: true, count: 2 });
    const runs = await db().select().from(schema.runs);
    expect(runs.map((run) => [run.igUserId, run.commentId, run.source, run.state]).sort()).toEqual([
      ["ig_ana", "c1", "earlier", "opening_sent"],
      ["ig_ben", "c3", "earlier", "opening_sent"],
    ]);
    expect(openingDms(adeli.sent).map((item) => (item.body?.recipient as { commentId: string }).commentId).sort()).toEqual(["c1", "c3"]);
    // The public reply is on by default, so each one also got a reply under their comment.
    expect(adeli.sent.filter((item) => item.path === "/comments" && item.method === "POST")).toHaveLength(2);

    // Sending again finds nobody new.
    expect(await sendNow()).toMatchObject({ ok: true, count: 0 });
    expect(openingDms(adeli.sent)).toHaveLength(2);
  });

  it("skips people who already have a run from a live comment", async () => {
    await db().insert(schema.runs).values({ automationId, igUserId: "ig_ana", commentId: "live_1", state: "opening_sent" });
    fakeAdeli([commentsRoute([{ id: "c1", authorId: "ig_ana" }, { id: "c2", authorId: "ig_ben" }])]);

    expect(await previewEarlierComments(USER, automationId)).toMatchObject({ ok: true, count: 1 });
  });

  it("skips comments another automation already answered, but not their other comments", async () => {
    const other = await seedLiveAutomation(accountId, { name: "Old", status: "paused" });
    await db().insert(schema.runs).values({ automationId: other.id, igUserId: "ig_ana", commentId: "c1", state: "final_sent" });
    fakeAdeli([commentsRoute([{ id: "c1", authorId: "ig_ana", hours: 2 }, { id: "c2", authorId: "ig_ana", hours: 1 }, { id: "c3", authorId: "ig_ben" }])]);

    expect(await previewEarlierComments(USER, automationId)).toMatchObject({ ok: true, count: 2 });
  });

  it("leaves comments to a post's own automation when a Next post automation is bound to it too", async () => {
    const trigger = { ...defaultAutomationContent(0).trigger, postScope: "next" as const, mediaId: "media_1", match: "any" as const, keywords: [] };
    const next = await seedLiveAutomation(accountId, { name: "Next", trigger });
    fakeAdeli([commentsRoute([{ id: "c1", authorId: "ig_ana", body: "guide" }, { id: "c2", authorId: "ig_ben", body: "hello" }])]);

    // "guide" belongs to the post's own automation; only "hello" is left for Next post.
    expect(await previewEarlierComments(USER, next.id)).toMatchObject({ ok: true, count: 1 });
  });

  it("counts for Free, but only sends on Pro when billing is on", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_ledachat");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const adeli = fakeAdeli([commentsRoute([{ id: "c1" }])]);

    expect(await previewEarlierComments(USER, automationId)).toMatchObject({ ok: true, count: 1, allowed: false, upgradeUrl: expect.stringContaining("/settings#plan") });
    expect(await sendNow()).toMatchObject({ ok: false, reason: "pro" });
    expect(openingDms(adeli.sent)).toHaveLength(0);

    await db().insert(schema.billingCustomers).values({ userId: USER, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" });
    expect(await sendNow()).toMatchObject({ ok: true, count: 1 });
  });

  it("reads Adeli once for a quick count", async () => {
    const adeli = fakeAdeli([commentsRoute([{ id: "c1" }], [false])]);

    expect(await previewEarlierComments(USER, automationId, { quick: true })).toMatchObject({ ok: true, count: 1, complete: false });
    expect(adeli.sent.filter((item) => item.path === "/comments")).toHaveLength(1);
  });

  it("needs a live automation for one post", async () => {
    fakeAdeli([commentsRoute([{ id: "c1" }])]);
    const draft = await seedLiveAutomation(accountId, { name: "Draft", status: "draft", trigger: { ...defaultAutomationContent(0).trigger, mediaId: "media_2", match: "keywords", keywords: ["other"] } });
    await expect(previewEarlierComments(USER, draft.id)).rejects.toThrow(ServiceError);

    const any = await seedLiveAutomation(accountId, { name: "Any", trigger: { ...defaultAutomationContent(0).trigger, postScope: "any", mediaId: null, match: "keywords", keywords: ["everywhere"] } });
    await expect(previewEarlierComments(USER, any.id)).rejects.toThrow("one post");
  });
});

describe("listPostComments", () => {
  it("reads again until Adeli has every comment", async () => {
    const adeli = fakeAdeli([commentsRoute([{ id: "c1" }], [false, false, true])]);

    const result = await listPostComments(USER, "acc_1", "media_1", { waitMs: 0 });

    expect(result.complete).toBe(true);
    expect(adeli.sent.filter((item) => item.path === "/comments")).toHaveLength(3);
  });

  it("gives up after its attempts and says the list is incomplete", async () => {
    fakeAdeli([commentsRoute([{ id: "c1" }], [false])]);

    expect(await listPostComments(USER, "acc_1", "media_1", { attempts: 2, waitMs: 0 })).toMatchObject({ complete: false, comments: [expect.objectContaining({ id: "c1" })] });
  });
});
