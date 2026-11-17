/**
 * LedaChat's hosted plans, shared by the landing page (what we sell) and the
 * app (what we enforce), so the two can't drift. A self-hosted install has no
 * Stripe keys, so nothing is limited; its branding follows LEDACHAT_BRANDING.
 */
export const PLANS = {
  free: { name: "Free", priceCents: 0, liveAutomations: 10, branding: true },
  pro: { name: "Pro", priceCents: 2500, liveAutomations: null, branding: false },
} as const;

export type PlanId = keyof typeof PLANS;

/** Free's live automation limit, as quoted on the landing page. */
export const FREE_LIVE_AUTOMATIONS = PLANS.free.liveAutomations;

/** Pro's monthly price in whole dollars, as quoted on the landing page. */
export const PRO_MONTHLY_DOLLARS = PLANS.pro.priceCents / 100;

/** Sent as its own message after a Free user's Final DM (`apps/web/src/lib/plan.ts`). */
export const BRANDING_TEXT = "Powered by LedaChat";
