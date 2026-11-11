import "server-only";

import { appUrl } from "@/lib/app-url";
import { adeliCall } from "@/lib/adeli/client";
import { ensureUserProfile } from "@/lib/adeli/profile";
import { getUserSettings, saveWebhook } from "@/lib/user-settings";

/** `message.created` carries the email people type in reply to the email step. */
export const WEBHOOK_EVENTS = ["comment.created", "message.postback", "message.created"] as const;

/** Each user has their own webhook URL, so a delivery is checked with, and handled for, that user only. */
export function webhookUrl(userId: string) {
  return new URL(`/api/webhooks/adeli/${encodeURIComponent(userId)}`, appUrl()).toString();
}

/**
 * Makes sure Adeli delivers this user's events. Reuses the stored webhook
 * while Adeli still lists it for the same URL; otherwise creates one and
 * stores its id and signing secret. The webhook is on the user's own
 * profile, so it only delivers their accounts' events. Safe to call on every boot.
 */
export async function ensureAdeliWebhook(userId: string): Promise<{ id: string; created: boolean }> {
  const url = webhookUrl(userId);
  const profileId = (await ensureUserProfile(userId)).id;
  const settings = await getUserSettings(userId);

  const { data } = await adeliCall((client) => client.webhooks.listWebhooks({ query: { profileId } }));
  const existing = data.webhooks.find((webhook) => webhook.id === settings.adeliWebhookId);
  // A webhook from before an event was added gets replaced, so it starts delivering that event too.
  const hasEvents = existing && WEBHOOK_EVENTS.every((event) => (existing.events as readonly string[]).includes(event));
  if (existing && hasEvents && existing.url === url && existing.status === "active" && settings.adeliWebhookSecret) {
    return { id: existing.id, created: false };
  }

  const created = await adeliCall((client) => client.webhooks.createWebhook({ body: { profileId, url, events: [...WEBHOOK_EVENTS] } }));
  await saveWebhook(userId, { profileId, id: created.data.webhook.id, secret: created.data.secret });
  // The old one points somewhere else or stopped working. Don't leave it delivering.
  if (existing) await adeliCall((client) => client.webhooks.deleteWebhook({ path: { webhookId: existing.id } })).catch(() => undefined);
  return { id: created.data.webhook.id, created: true };
}
