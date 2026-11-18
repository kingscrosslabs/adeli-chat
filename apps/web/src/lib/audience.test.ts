import { beforeEach, describe, expect, it } from "vitest";

import { audienceCsv, listAudience, listAutomationPeople, listContactRuns } from "@/lib/audience";
import { db, schema } from "@/lib/db";

import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../test/db-helpers";

type RunInsert = typeof schema.runs.$inferInsert;

let accountId: string;
let guide: string;
let recipe: string;

async function run(automationId: string, igUserId: string, values: Partial<RunInsert> = {}) {
  await db().insert(schema.runs).values({ automationId, igUserId, commentId: `${automationId}_${igUserId}`, ...values });
}

beforeEach(async () => {
  await resetDatabase();
  await seedUser();
  accountId = (await seedAccount()).id;
  guide = (await seedLiveAutomation(accountId, { name: "Guide" })).id;
  recipe = (await seedLiveAutomation(accountId, { name: "Recipe" })).id;
});

describe("listAudience", () => {
  it("groups runs by person, most engaged first", async () => {
    await run(guide, "ig_once", { igUsername: "once", state: "opening_sent", createdAt: new Date("2026-11-10T00:00:00Z") });
    await run(guide, "ig_fan", { igUsername: "old_handle", state: "final_sent", tappedAt: new Date(), createdAt: new Date("2026-11-01T00:00:00Z") });
    await run(recipe, "ig_fan", { igUsername: "new_handle", state: "awaiting_email", tappedAt: new Date(), createdAt: new Date("2026-11-05T00:00:00Z") });
    await db().insert(schema.leads).values({ automationId: recipe, igUserId: "ig_fan", email: "fan@example.com" });

    const audience = await listAudience(accountId);

    expect(audience.map((contact) => contact.igUserId)).toEqual(["ig_fan", "ig_once"]);
    expect(audience[0]).toMatchObject({
      igUsername: "new_handle",
      automations: 2,
      buttonTaps: 2,
      finalDms: 1,
      email: "fan@example.com",
      firstSeenAt: "2026-11-01T00:00:00.000Z",
      lastSeenAt: "2026-11-05T00:00:00.000Z",
    });
    expect(audience[1]).toMatchObject({ automations: 1, buttonTaps: 0, finalDms: 0, email: null });
  });

  it("only reads the account's own automations", async () => {
    await seedUser("user_2");
    const [other] = await db().insert(schema.accounts).values({ userId: "user_2", adeliAccountId: "acc_2", adeliProfileId: "profile_2", handle: "cats", displayName: "Cats" }).returning();
    const theirs = await seedLiveAutomation(other.id);
    await run(theirs.id, "ig_stranger");

    expect(await listAudience(accountId)).toEqual([]);
    expect(await listAutomationPeople(accountId, theirs.id)).toEqual([]);
    expect(await listContactRuns(accountId, "ig_stranger")).toEqual([]);
  });
});

describe("listAutomationPeople", () => {
  it("lists one automation's people with their stage, comment and email", async () => {
    await run(guide, "ig_fan", { igUsername: "fan", state: "final_sending", commentText: "guide please", createdAt: new Date("2026-11-02T00:00:00Z") });
    await run(guide, "ig_new", { igUsername: "new", state: "failed", source: "earlier", createdAt: new Date("2026-11-03T00:00:00Z") });
    await run(recipe, "ig_other");
    await db().insert(schema.leads).values({ automationId: guide, igUserId: "ig_fan", email: "fan@example.com" });

    const people = await listAutomationPeople(accountId, guide);

    expect(people).toEqual([
      { igUserId: "ig_new", igUsername: "new", stage: "failed", commentText: null, source: "earlier", email: null, triggeredAt: "2026-11-03T00:00:00.000Z" },
      { igUserId: "ig_fan", igUsername: "fan", stage: "tapped", commentText: "guide please", source: "live", email: "fan@example.com", triggeredAt: "2026-11-02T00:00:00.000Z" },
    ]);
  });
});

describe("listContactRuns", () => {
  it("lists every automation one person triggered, newest first", async () => {
    await run(guide, "ig_fan", { createdAt: new Date("2026-11-01T00:00:00Z") });
    await run(recipe, "ig_fan", { createdAt: new Date("2026-11-04T00:00:00Z"), state: "final_sent" });
    await run(recipe, "ig_someone_else");

    const runs = await listContactRuns(accountId, "ig_fan");

    expect(runs.map((item) => [item.automationName, item.stage])).toEqual([["Recipe", "final_sent"], ["Guide", "matched"]]);
  });
});

describe("audienceCsv", () => {
  it("writes a header and defuses spreadsheet formulas", () => {
    const csv = audienceCsv([{ igUserId: "ig_1", igUsername: "=fan", automations: 2, buttonTaps: 1, finalDms: 1, email: null, firstSeenAt: "a", lastSeenAt: "b" }]);
    expect(csv).toBe("Instagram username,Instagram user id,Automations triggered,Button taps,Final DMs,Email,First seen,Last seen\r\n'=fan,ig_1,2,1,1,,a,b\r\n");
  });
});
