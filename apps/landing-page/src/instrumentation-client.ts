import posthog from "posthog-js";

/**
 * PostHog for the landing page (its own PostHog project, separate from the
 * app's). Optional: without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN nothing is sent.
 * Events go through `/ingest` on this site (rewrites in next.config.ts), so
 * ad blockers don't drop them.
 *
 * Clicks are tracked from markup: any element with `data-ph-event` sends that
 * event when clicked, with its other `data-ph-*` attributes as properties
 * (`data-ph-location="hero"` becomes `location: "hero"`). That keeps the page
 * a server component.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",
    defaults: "2026-08-30",
    person_profiles: "identified_only",
  });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-ph-event]") : null;
    if (!target) return;
    const { phEvent, ...rest } = target.dataset;
    const properties: Record<string, string> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith("ph") && key.length > 2 && value !== undefined) properties[snakeCase(key.slice(2))] = value;
    }
    const href = target.getAttribute("href");
    if (href) properties.href = href;
    posthog.capture(phEvent!, properties);
  }, { capture: true });
} else if (process.env.NODE_ENV === "development") {
  console.error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured");
}

function snakeCase(value: string) {
  return value.replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
