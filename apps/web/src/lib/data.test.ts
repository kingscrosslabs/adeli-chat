import { beforeEach, describe, expect, it } from "vitest";

import { resetDatabase, seedAccount, seedLiveAutomation, seedUser } from "../../test/db-helpers";

import { getAutomation, getConnectedAccount, listAutomations } from "./data";

beforeEach(async () => {
  await resetDatabase();
  await seedUser("user_1");
  await seedUser("user_2");
});

describe("per-user data", () => {
  it("only finds the signed-in user's account and automations", async () => {
    const mine = await seedAccount("user_1");
    const automation = await seedLiveAutomation(mine.id);

    expect((await getConnectedAccount("user_1"))?.id).toBe(mine.id);
    expect(await getConnectedAccount("user_2")).toBeNull();

    // user_2 connects the same Instagram account through their own Adeli key: a separate row.
    const theirs = await seedAccount("user_2");
    expect(theirs.id).not.toBe(mine.id);
    expect(await getAutomation(theirs.id, automation.id)).toBeNull();
    expect(await listAutomations(theirs.id)).toEqual([]);
    expect((await listAutomations(mine.id)).map((item) => item.id)).toEqual([automation.id]);
  });
});
