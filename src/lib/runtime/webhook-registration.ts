import "server-only";

import { eq } from "drizzle-orm";

import { getAppSettings } from "@/lib/app-settings";
import { adeliCall } from "@/lib/adeli/client";
import { listProfiles } from "@/lib/adeli/instagram";
import { db, schema } from "@/lib/db";

const DEFAULT_APP_URL = "http://localhost:3030";

export const WEBHOOK_EVENTS = ["comment.created", "message.postback"] as const;

/** Where this install is reachable. Optional: defaults to the local dev server. */
export function appUrl() {
  return process.env.APP_URL?.trim() || DEFAULT_APP_URL;
}

export function webhookUrl() {
  return new URL("/api/webhooks/adeli", appUrl()).toString();
}

/**
 * Makes sure Adeli delivers this install's events. Reuses the stored webhook
 * while Adeli still lists it for the same URL; otherwise creates one and
 * stores its id and signing secret. Safe to call on every boot.
 */
export async function ensureAdeliWebhook(): Promise<{ id: string; created: boolean }> {
  const url = webhookUrl();
  const settings = await getAppSettings();
  const profileId = settings.adeliProfileId ?? (await listProfiles())[0]?.id;
  if (!profileId) throw new Error("This Adeli organization doesn't have a profile yet.");

  const { data } = await adeliCall((client) => client.webhooks.listWebhooks({ query: { profileId } }));
  const existing = data.webhooks.find((webhook) => webhook.id === settings.adeliWebhookId);
  if (existing && existing.url === url && existing.status === "active" && settings.adeliWebhookSecret) {
    return { id: existing.id, created: false };
  }

  const created = await adeliCall((client) => client.webhooks.createWebhook({ body: { profileId, url, events: [...WEBHOOK_EVENTS] } }));
  await db().update(schema.appSettings).set({
    adeliProfileId: profileId,
    adeliWebhookId: created.data.webhook.id,
    adeliWebhookSecret: created.data.secret,
    updatedAt: new Date(),
  }).where(eq(schema.appSettings.id, 1));
  // The old one points somewhere else or stopped working. Don't leave it delivering.
  if (existing) await adeliCall((client) => client.webhooks.deleteWebhook({ path: { webhookId: existing.id } })).catch(() => undefined);
  return { id: created.data.webhook.id, created: true };
}
