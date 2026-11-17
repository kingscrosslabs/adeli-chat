import "server-only";

import { isPro } from "@/lib/billing/state";
import { BRANDING_TEXT } from "@adeli-chat/ui/billing/plans";

/** Sent after the Final DM for users on the free plan. */
export { BRANDING_TEXT };

/**
 * Whether this install adds branding at all. On unless `LEDACHAT_BRANDING` is
 * `off` (or `false`/`0`), so a self-hosted install can turn it off for everyone.
 */
export function brandingEnabled() {
  const value = process.env.LEDACHAT_BRANDING?.trim().toLowerCase();
  return !value || !["off", "false", "0"].includes(value);
}

/**
 * Whether this user's Final DMs get the branding message: branding on for the
 * install, and not Pro (an active Stripe subscription or `user_settings.plan`).
 */
export async function showsBranding(userId: string) {
  if (!brandingEnabled()) return false;
  return !(await isPro(userId));
}
