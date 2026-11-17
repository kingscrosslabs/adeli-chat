"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Ties this browser's PostHog events to the signed-in user. The id is the
 * same one server events use (`src/lib/analytics/server.ts`), so both land on
 * one person. Renders nothing.
 */
export function PostHogIdentify({ user }: { user: { id: string; email: string; name: string } }) {
  useEffect(() => {
    if (!posthog.__loaded) return;
    if (posthog.get_distinct_id() !== user.id) posthog.identify(user.id, { email: user.email, name: user.name });
  }, [user.id, user.email, user.name]);
  return null;
}

/** On the sign-in page: whoever used this browser before is signed out, so start a fresh anonymous person. */
export function PostHogReset() {
  useEffect(() => {
    if (posthog.__loaded && posthog.get_property("$user_state") === "identified") posthog.reset();
  }, []);
  return null;
}
