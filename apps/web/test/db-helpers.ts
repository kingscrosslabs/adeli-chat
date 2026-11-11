import { sql } from "drizzle-orm";

import { defaultAutomationContent } from "@adeli-chat/ui/automation/defaults";
import { db, schema } from "@/lib/db";

/** The server's `ADELI_API_KEY` in tests (set in `vitest.config.ts`). */
export const TEST_KEY = `rk_live_${"a".repeat(43)}`;

export async function resetDatabase() {
  await db().execute(sql`truncate runs, automations, accounts, user_settings, auth_user cascade`);
}

/** A signed-in user whose Adeli profile was already created. Pass `profileId: null` for a user without one yet. */
export async function seedUser(id = "user_1", { profileId = "profile_1" as string | null } = {}) {
  await db().insert(schema.authUser).values({ id, name: id, email: `${id}@example.com` });
  await db().insert(schema.userSettings).values({ userId: id, adeliProfileId: profileId, adeliProfileName: profileId ? "Nick" : null });
  return id;
}

export async function seedAccount(userId = "user_1") {
  const [account] = await db().insert(schema.accounts).values({
    userId,
    adeliAccountId: "acc_1",
    adeliProfileId: "profile_1",
    igUserId: "ig_self",
    handle: "birds",
    displayName: "Birds",
  }).returning();
  return account;
}

export async function seedLiveAutomation(accountId: string, overrides: Partial<typeof schema.automations.$inferInsert> = {}) {
  const content = defaultAutomationContent(0);
  const [automation] = await db().insert(schema.automations).values({
    accountId,
    ...content,
    name: "Guide",
    status: "live",
    liveAt: new Date(),
    trigger: { ...content.trigger, mediaId: "media_1", match: "keywords", keywords: ["guide"] },
    finalDm: { type: "text_buttons", text: "Here it is!", buttons: [{ label: "Get it", url: "https://example.com/guide" }] },
    ...overrides,
  }).returning();
  return automation;
}
