import posthog from "posthog-js";

/**
 * PostHog in the browser (the app's own PostHog project, separate from the
 * landing page's). Optional: without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN nothing
 * is sent. Events go through `/ingest` on this app (rewrites in
 * next.config.ts), so ad blockers don't drop them. The signed-in user is
 * identified by `<PostHogIdentify>`; most product events are captured on the
 * server (`src/lib/analytics/server.ts`) with the same user id.
 *
 * Clicks can be tracked from markup: an element with `data-ph-event` sends
 * that event when clicked, with its other `data-ph-*` attributes as
 * properties (`data-ph-agent="claude"` becomes `agent: "claude"`).
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",
    defaults: "2026-08-30",
    capture_exceptions: true,
  });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-ph-event]") : null;
    if (!target) return;
    const { phEvent, ...rest } = target.dataset;
    const properties: Record<string, string> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith("ph") && key.length > 2 && value !== undefined) properties[snakeCase(key.slice(2))] = value;
    }
    posthog.capture(phEvent!, properties);
  }, { capture: true });
} else if (process.env.NODE_ENV === "development") {
  console.error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured");
}

function snakeCase(value: string) {
  return value.replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
