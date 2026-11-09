import "server-only";

import { db, schema } from "@/lib/db";

export type AppSettings = typeof schema.appSettings.$inferSelect;
export type KeyStatus = AppSettings["adeliKeyStatus"];

/** The single `app_settings` row, created on first read. */
export async function getAppSettings(): Promise<AppSettings> {
  const [row] = await db().insert(schema.appSettings).values({ id: 1 }).onConflictDoNothing().returning();
  if (row) return row;
  const [existing] = await db().select().from(schema.appSettings).limit(1);
  return existing;
}

/** Records the result of a key check, and the profile it reached when valid. */
export async function markKeyStatus(status: KeyStatus, profile?: { id: string; name: string }) {
  const now = new Date();
  const values = {
    adeliKeyStatus: status,
    adeliKeyCheckedAt: now,
    updatedAt: now,
    ...(profile ? { adeliProfileId: profile.id, adeliProfileName: profile.name } : {}),
  };
  await db().insert(schema.appSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: schema.appSettings.id, set: values });
}

/**
 * Stores the Adeli connection entered in Settings. `apiKey` is sealed before
 * it's written; null clears it (falling back to `ADELI_API_KEY`). When the new
 * key can't reach the stored profile, the profile and webhook are forgotten so
 * the next check registers a webhook for the new organization.
 */
export async function saveAdeliConnection(input: { sealedApiKey?: string | null; baseUrl: string | null; keepProfile: boolean }) {
  const now = new Date();
  const values = {
    ...(input.sealedApiKey !== undefined ? { adeliApiKeyEncrypted: input.sealedApiKey } : {}),
    adeliBaseUrl: input.baseUrl,
    adeliKeyStatus: "unchecked" as const,
    updatedAt: now,
    ...(input.keepProfile ? {} : { adeliProfileId: null, adeliProfileName: null, adeliWebhookId: null, adeliWebhookSecret: null }),
  };
  await db().insert(schema.appSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: schema.appSettings.id, set: values });
}
