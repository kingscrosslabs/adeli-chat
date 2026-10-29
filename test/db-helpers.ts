import { sql } from "drizzle-orm";

import { defaultAutomationContent } from "@/lib/automations/defaults";
import { db, schema } from "@/lib/db";

export async function resetDatabase() {
  await db().execute(sql`truncate runs, automations, accounts, app_settings cascade`);
}

export async function seedAccount() {
  const [account] = await db().insert(schema.accounts).values({
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
