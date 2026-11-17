import "server-only";

import { after } from "next/server";

/**
 * Slack incoming webhooks for the team's own alerts, the same ones Adeli
 * posts to. Optional: an unset variable sends nothing. Alerts may name the
 * LedaChat user (name, email, Instagram handle), never a commenter or lead.
 */
export type SlackChannel = "billing" | "signups";

const VARIABLES: Record<SlackChannel, string> = {
  billing: "SLACK_BILLING_ALERT_WEBHOOK_URL",
  signups: "SLACK_SIGNUP_WEBHOOK_URL",
};

export function slackWebhookUrl(channel: SlackChannel): string | null {
  return process.env[VARIABLES[channel]]?.trim() || null;
}

/** Escapes the three characters Slack's mrkdwn treats as markup. */
export function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Posts `text` and waits for Slack. False when the channel has no webhook; throws when Slack refuses. */
export async function postSlack(channel: SlackChannel, text: string): Promise<boolean> {
  const url = slackWebhookUrl(channel);
  if (!url) {
    console.warn(`Slack alert not sent: ${VARIABLES[channel]} is not set`);
    return false;
  }
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Slack answered ${response.status}`);
  return true;
}

/**
 * Posts `text` after the response, never throwing and never retried. The
 * returned promise settles when Slack answers; callers needn't await it.
 */
export function notifySlack(channel: SlackChannel, text: string): Promise<void> {
  if (!slackWebhookUrl(channel)) return Promise.resolve();
  const sending = postSlack(channel, text).then(() => undefined, (error: unknown) => console.warn(`Couldn't post a Slack alert: ${error instanceof Error ? error.message : String(error)}`));
  try {
    after(sending);
  } catch {
    // Outside a request (tests, background work): it finishes on its own.
  }
  return sending;
}
