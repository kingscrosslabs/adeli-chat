/**
 * Subscription statuses that count as paying. `past_due` is included on
 * purpose: while Stripe retries a failed card, the user keeps Pro (the grace
 * period). `unpaid`, `canceled` and the incomplete states are Free.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return status !== null && status !== undefined && ACTIVE_STATUSES.has(status);
}
