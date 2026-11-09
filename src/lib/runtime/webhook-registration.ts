import "server-only";

import { appUrl } from "@/lib/app-url";
import { adeliCall } from "@/lib/adeli/client";
import { listProfiles } from "@/lib/adeli/instagram";
import { getUserSettings, saveWebhook } from "@/lib/user-settings";

export const WEBHOOK_EVENTS = ["comment.created", "message.postback"] as const;

/** Each user has their own webhook URL, so a delivery is checked with, and handled for, that user only. */
export function webhookUrl(userId: string) {
  return new URL(`/api/webhooks/adeli/${encodeURIComponent(userId)}`, appUrl()).toString();
}

/**
 * Makes sure Adeli delivers this user's events. Reuses the stored webhook
 * while Adeli still lists it for the same URL; otherwise creates one and
 * stores its id and signing secret. Safe to call on every boot.
 */
export async function ensureAdeliWebhook(userId: string): Promise<{ id: string; created: boolean }> {
  const url = webhookUrl(userId);
  const settings = await getUserSettings(userId);
  const profileId = settings.adeliProfileId ?? (await listProfiles(userId))[0]?.id;
  if (!profileId) throw new Error("This Adeli organization doesn't have a profile yet.");

  const { data } = await adeliCall(userId, (client) => client.webhooks.listWebhooks({ query: { profileId } }));
  const existing = data.webhooks.find((webhook) => webhook.id === settings.adeliWebhookId);
  if (existing && existing.url === url && existing.status === "active" && settings.adeliWebhookSecret) {
    return { id: existing.id, created: false };
  }

  const created = await adeliCall(userId, (client) => client.webhooks.createWebhook({ body: { profileId, url, events: [...WEBHOOK_EVENTS] } }));
  await saveWebhook(userId, { profileId, id: created.data.webhook.id, secret: created.data.secret });
  // The old one points somewhere else or stopped working. Don't leave it delivering.
  if (existing) await adeliCall(userId, (client) => client.webhooks.deleteWebhook({ path: { webhookId: existing.id } })).catch(() => undefined);
  return { id: created.data.webhook.id, created: true };
}
