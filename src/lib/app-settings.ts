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
