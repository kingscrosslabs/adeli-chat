import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAutomationContent } from "@adeli-chat/ui/automation/defaults";
import { db, schema } from "@/lib/db";

import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../../test/db-helpers";

import { goLive, saveAutomation } from "./service";

const USER = "user_1";
let accountId: string;

function billingOn() {
  vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_ledachat");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
}

async function seedLive(count: number) {
  for (let index = 0; index < count; index += 1) await seedLiveAutomation(accountId, { name: `Live ${index}`, trigger: { ...defaultAutomationContent(0).trigger, mediaId: `media_${index}`, match: "keywords", keywords: [`word${index}`] } });
}

async function seedDraft(keyword = "fresh") {
  const automation = await seedLiveAutomation(accountId, { name: "Draft", status: "draft", liveAt: null, trigger: { ...defaultAutomationContent(0).trigger, mediaId: `media_${keyword}`, match: "keywords", keywords: [keyword] } });
  return automation.id;
}

beforeEach(async () => {
  await resetDatabase();
  await seedUser(USER);
  accountId = (await seedAccount(USER)).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the Free live automation limit", () => {
  it("lets the 10th go live and refuses the 11th", async () => {
    billingOn();
    await seedLive(9);
    expect(await goLive(USER, await seedDraft("tenth"))).toEqual({ ok: true });
    const refused = await goLive(USER, await seedDraft("eleventh"));
    expect(refused).toMatchObject({ ok: false, reason: "limit", limit: 10, upgradeUrl: "http://localhost:3030/settings#plan" });
  });

  it("never refuses going live again or saving an automation that's already live", async () => {
    billingOn();
    await seedLive(10);
    const [live] = await db().select().from(schema.automations).where(eq(schema.automations.status, "live")).limit(1);
    expect(await goLive(USER, live.id)).toEqual({ ok: true });
    expect(await saveAutomation(USER, live.id, { ...live, name: "Renamed" })).toEqual({ ok: true });
  });

  it("is unlimited on Pro", async () => {
    billingOn();
    await db().insert(schema.billingCustomers).values({ userId: USER, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" });
    await seedLive(10);
    expect(await goLive(USER, await seedDraft())).toEqual({ ok: true });
  });

  it("is unlimited without Stripe keys (local and self-hosted)", async () => {
    await seedLive(10);
    expect(await goLive(USER, await seedDraft())).toEqual({ ok: true });
  });

  it("lets exactly one of two concurrent Go Lives through at 9", async () => {
    billingOn();
    await seedLive(9);
    const [first, second] = await Promise.all([goLive(USER, await seedDraft("one")), goLive(USER, await seedDraft("two"))]);
    expect([first.ok, second.ok].sort()).toEqual([false, true]);
    expect(await db().select().from(schema.automations).where(eq(schema.automations.status, "live"))).toHaveLength(10);
  });

  it("doesn't count another user's automations", async () => {
    billingOn();
    await seedUser("user_2");
    const [other] = await db().insert(schema.accounts).values({ userId: "user_2", adeliAccountId: "acc_2", adeliProfileId: "profile_2", igUserId: "ig_2", handle: "other", displayName: "Other" }).returning();
    for (let index = 0; index < 10; index += 1) await seedLiveAutomation(other.id, { trigger: { ...defaultAutomationContent(0).trigger, mediaId: `other_${index}`, match: "keywords", keywords: [`other${index}`] } });
    expect(await goLive(USER, await seedDraft())).toEqual({ ok: true });
  });
});
