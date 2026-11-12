import "server-only";

import { after } from "next/server";
import { PostHog } from "posthog-node";

/**
 * Product analytics on the server, in the app's PostHog project. Optional:
 * without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN every call does nothing. Events
 * are about the LedaChat user (the workspace owner), keyed by their user id,
 * the same id `<PostHogIdentify>` uses in the browser. Never put commenters'
 * or leads' personal details (emails, usernames, message text) in properties.
 *
 * Tracking never throws and never makes a request wait: each event is sent
 * after the response (`after`), or in the background outside a request.
 */

/** Where a change came from: the app's UI, or an AI agent over `/mcp`. */
export type Source = "app" | "mcp";

type Properties = Record<string, string | number | boolean | null | undefined>;

let client: PostHog | null | undefined;
let warned = false;

function posthog(): PostHog | null {
  if (client !== undefined) return client;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "development" && !warned) {
      warned = true;
      console.error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured");
    }
    client = null;
    return client;
  }
  client = new PostHog(token, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com", flushAt: 1, flushInterval: 0 });
  return client;
}

function send(work: (posthog: PostHog) => Promise<unknown>) {
  const ph = posthog();
  if (!ph) return;
  const sending = work(ph).catch((error: unknown) => console.warn(`Couldn't send a PostHog event: ${error instanceof Error ? error.message : String(error)}`));
  try {
    after(sending);
  } catch {
    // Outside a request (tests, startup): it finishes in the background.
  }
}

/** Records `event` for the user `userId`. */
export function track(userId: string, event: string, properties: Properties = {}) {
  send((ph) => ph.captureImmediate({ distinctId: userId, event, properties }));
}

/** Sets person properties (email, name) on the user, for a new sign-up. */
export function identifyUser(userId: string, properties: { email: string; name: string }) {
  send((ph) => ph.identifyImmediate({ distinctId: userId, properties }));
}

/** Reports an unexpected error to PostHog error tracking, for `userId` when known. */
export function trackError(error: unknown, userId?: string, properties: Properties = {}) {
  send(async (ph) => {
    ph.captureException(error, userId, properties);
    await ph.flush();
  });
}
