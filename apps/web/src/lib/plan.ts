import "server-only";

import { getUserSettings } from "@/lib/user-settings";

/** Sent after the Final DM for users on the free plan. */
export const BRANDING_TEXT = "Powered by LedaChat.com";

/**
 * Whether this install adds branding at all. On unless `LEDACHAT_BRANDING` is
 * `off` (or `false`/`0`), so a self-hosted install can turn it off for everyone.
 */
export function brandingEnabled() {
  const value = process.env.LEDACHAT_BRANDING?.trim().toLowerCase();
  return !value || !["off", "false", "0"].includes(value);
}

/** Whether this user's Final DMs get the branding message: free plan, and branding on for the install. */
export async function showsBranding(userId: string) {
  if (!brandingEnabled()) return false;
  const settings = await getUserSettings(userId);
  return settings.plan !== "pro";
}
