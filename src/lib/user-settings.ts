import "server-only";

import { eq, isNotNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/** One user's Adeli connection: key status, default profile and webhook. */
export type UserSettings = typeof schema.userSettings.$inferSelect;
export type KeyStatus = UserSettings["adeliKeyStatus"];

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

/** Records the result of a key check, and the profile it reached when valid. */
export async function markKeyStatus(userId: string, status: KeyStatus, profile?: { id: string; name: string }) {
  await upsert(userId, {
    adeliKeyStatus: status,
    adeliKeyCheckedAt: new Date(),
    ...(profile ? { adeliProfileId: profile.id, adeliProfileName: profile.name } : {}),
  });
}

/** Stores the webhook Adeli created for this user, with its signing secret. */
export async function saveWebhook(userId: string, webhook: { profileId: string; id: string; secret: string }) {
  await upsert(userId, { adeliProfileId: webhook.profileId, adeliWebhookId: webhook.id, adeliWebhookSecret: webhook.secret });
}

/**
 * Stores the Adeli connection entered in Settings. `sealedApiKey` is already
 * encrypted; undefined keeps the saved one. When the new key can't reach the
 * stored profile, the profile and webhook are forgotten so the next check
 * registers a webhook for the new organization.
 */
export async function saveAdeliConnection(userId: string, input: { sealedApiKey?: string; baseUrl: string | null; keepProfile: boolean }) {
  await upsert(userId, {
    ...(input.sealedApiKey !== undefined ? { adeliApiKeyEncrypted: input.sealedApiKey } : {}),
    adeliBaseUrl: input.baseUrl,
    adeliKeyStatus: "unchecked",
    ...(input.keepProfile ? {} : { adeliProfileId: null, adeliProfileName: null, adeliWebhookId: null, adeliWebhookSecret: null }),
  });
}

/** Every user with a settings row. Local boot re-registers their webhooks. */
export async function allSettingsUsers(): Promise<string[]> {
  const rows = await db().select({ userId: schema.userSettings.userId }).from(schema.userSettings);
  return rows.map((row) => row.userId);
}

/** Webhook secrets by user, without creating rows. For verifying deliveries. */
export async function webhookSecrets(userId?: string): Promise<Array<{ userId: string; secret: string }>> {
  const rows = await db().select({ userId: schema.userSettings.userId, secret: schema.userSettings.adeliWebhookSecret })
    .from(schema.userSettings)
    .where(userId ? eq(schema.userSettings.userId, userId) : isNotNull(schema.userSettings.adeliWebhookSecret));
  return rows.flatMap((row) => (row.secret ? [{ userId: row.userId, secret: row.secret }] : []));
}
