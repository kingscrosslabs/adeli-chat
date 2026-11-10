import "server-only";

import { eq, isNotNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/** One user's Adeli profile and webhook. */
export type UserSettings = typeof schema.userSettings.$inferSelect;

/** The user's settings row, created on first read. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [row] = await db().insert(schema.userSettings).values({ userId }).onConflictDoNothing().returning();
  if (row) return row;
  const [existing] = await db().select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1);
  return existing;
}

async function upsert(userId: string, values: Partial<typeof schema.userSettings.$inferInsert>) {
  const set = { ...values, updatedAt: new Date() };
  await db().insert(schema.userSettings).values({ userId, ...set }).onConflictDoUpdate({ target: schema.userSettings.userId, set });
}

/** Stores the user's own Adeli profile (`ensureUserProfile`). */
export async function saveProfile(userId: string, profile: { id: string; name: string }) {
  await upsert(userId, { adeliProfileId: profile.id, adeliProfileName: profile.name });
}

/** Stores the webhook Adeli created for this user, with its signing secret. */
export async function saveWebhook(userId: string, webhook: { profileId: string; id: string; secret: string }) {
  await upsert(userId, { adeliProfileId: webhook.profileId, adeliWebhookId: webhook.id, adeliWebhookSecret: webhook.secret });
}

/** Every user with an Adeli profile. Local boot re-registers their webhooks. */
export async function usersWithProfile(): Promise<string[]> {
  const rows = await db().select({ userId: schema.userSettings.userId }).from(schema.userSettings).where(isNotNull(schema.userSettings.adeliProfileId));
  return rows.map((row) => row.userId);
}

/** Webhook secrets by user, without creating rows. For verifying deliveries. */
export async function webhookSecrets(userId?: string): Promise<Array<{ userId: string; secret: string }>> {
  const rows = await db().select({ userId: schema.userSettings.userId, secret: schema.userSettings.adeliWebhookSecret })
    .from(schema.userSettings)
    .where(userId ? eq(schema.userSettings.userId, userId) : isNotNull(schema.userSettings.adeliWebhookSecret));
  return rows.flatMap((row) => (row.secret ? [{ userId: row.userId, secret: row.secret }] : []));
}
