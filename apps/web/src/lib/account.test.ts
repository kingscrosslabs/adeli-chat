import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, schema } from "@/lib/db";

import { fakeAdeli } from "../../test/fake-adeli";
import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../test/db-helpers";

import { deleteUserAccount, deletionBlocker } from "./account";

const USER = { id: "user_1", email: "user_1@example.com" };

beforeEach(async () => {
  await resetDatabase();
  await seedUser("user_1");
  await seedUser("user_2");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function disconnectedAccountWithAutomation(userId: string) {
  const account = await seedAccount(userId);
  const automation = await seedLiveAutomation(account.id, { status: "draft", liveAt: null });
  await db().insert(schema.runs).values({ automationId: automation.id, igUserId: "ig_commenter", commentId: "comment_1" });
  await db().insert(schema.leads).values({ automationId: automation.id, igUserId: "ig_commenter", email: "lead@example.com" });
  await db().update(schema.accounts).set({ status: "disconnected" }).where(eq(schema.accounts.id, account.id));
  return { account, automation };
}

describe("deleting an account", () => {
  it("refuses while Instagram is connected", async () => {
    await seedAccount("user_1");
    expect(await deletionBlocker("user_1")).toBe("Disconnect your Instagram account first.");
    await expect(deleteUserAccount(USER)).rejects.toThrow("Disconnect your Instagram account first.");
    expect(await db().select().from(schema.authUser).where(eq(schema.authUser.id, "user_1"))).toHaveLength(1);
  });

  it("refuses while Pro is active", async () => {
    await db().insert(schema.billingCustomers).values({ userId: "user_1", stripeCustomerId: "cus_1", subscriptionStatus: "active" });
    expect(await deletionBlocker("user_1")).toBe("Cancel your Pro subscription in Manage billing first.");
  });

  it("deletes the user and their data, then their Adeli profile and Loops contact", async () => {
    vi.stubEnv("LOOPS_API_KEY", "loops_test_key");
    await db().update(schema.userSettings).set({ adeliWebhookId: "wh_1" }).where(eq(schema.userSettings.userId, "user_1"));
    const mine = await disconnectedAccountWithAutomation("user_1");
    const adeli = fakeAdeli();

    expect(await deletionBlocker("user_1")).toBeNull();
    await deleteUserAccount(USER);

    expect(await db().select().from(schema.authUser).where(eq(schema.authUser.id, "user_1"))).toEqual([]);
    expect(await db().select().from(schema.userSettings).where(eq(schema.userSettings.userId, "user_1"))).toEqual([]);
    expect(await db().select().from(schema.accounts).where(eq(schema.accounts.id, mine.account.id))).toEqual([]);
    expect(await db().select().from(schema.automations).where(eq(schema.automations.id, mine.automation.id))).toEqual([]);
    expect(await db().select().from(schema.runs)).toEqual([]);
    expect(await db().select().from(schema.leads)).toEqual([]);
    // Someone else's account stays.
    expect(await db().select().from(schema.authUser).where(eq(schema.authUser.id, "user_2"))).toHaveLength(1);

    const calls = adeli.sent.map((sent) => `${sent.method} ${sent.path}`);
    expect(calls).toContain("DELETE /webhooks/wh_1");
    expect(calls).toContain("DELETE /profiles/profile_1");
    const loops = adeli.fetch.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input)).filter((url) => url.includes("loops.so"));
    expect(loops).toEqual(["https://app.loops.so/api/v1/contacts/delete"]);
  });

  it("still deletes the account when Adeli and Loops fail", async () => {
    vi.stubEnv("LOOPS_API_KEY", "loops_test_key");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fakeAdeli([() => ({ status: 500, body: { error: { code: "server_error", message: "Down" } } })]);

    await deleteUserAccount(USER);

    expect(await db().select().from(schema.authUser).where(eq(schema.authUser.id, "user_1"))).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Couldn't delete the Adeli profile of deleted user user_1"));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Couldn't delete the Loops contact of deleted user user_1"));
  });
});
