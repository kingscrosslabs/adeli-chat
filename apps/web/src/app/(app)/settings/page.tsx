import type { PlanStatus } from "@/components/settings/plan-card";
import { SettingsView } from "@/components/settings/settings-view";
import { deletionBlocker } from "@/lib/account";
import { serverKeyRejected } from "@/lib/adeli/client";
import { DEFAULT_BASE_URL, findAdeliConfig } from "@/lib/adeli/key";
import { authEnabled } from "@/lib/auth/config";
import { requireUserPage } from "@/lib/auth/session";
import { getStripeConfig } from "@/lib/billing/config";
import { getBillingCustomer, isPro } from "@/lib/billing/state";
import { getStripe } from "@/lib/billing/stripe";
import { reconcileSubscription } from "@/lib/billing/webhook";
import { getConnectedAccount, listAutomations } from "@/lib/data";
import { getUserSettings } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUserPage();
  const [account, settings] = await Promise.all([getConnectedAccount(user.id), getUserSettings(user.id)]);
  const automations = account ? await listAutomations(account.id) : [];
  const config = findAdeliConfig();
  const adeli = { configured: Boolean(config), rejected: serverKeyRejected(), baseURL: config?.baseURL ?? DEFAULT_BASE_URL, profileName: settings.adeliProfileName, localProfile: !authEnabled() };
  const plan = await planStatus(user.id);
  const deleteBlocker = authEnabled() ? await deletionBlocker(user.id) : null;
  return <SettingsView adeli={adeli} account={account} user={authEnabled() ? user : null} liveCount={automations.filter((automation) => automation.status === "live").length} plan={plan} deleteBlocker={deleteBlocker} />;
}

/** The Plan card's data, or null when billing is off. A missed webhook is repaired first, without ever blocking the page. */
async function planStatus(userId: string): Promise<PlanStatus | null> {
  const config = getStripeConfig();
  if (!config) return null;
  await reconcileSubscription(getStripe(config), userId).catch((error: unknown) => console.error(`Couldn't reconcile the subscription: ${error instanceof Error ? error.message : String(error)}`));
  const customer = await getBillingCustomer(userId);
  return {
    plan: (await isPro(userId)) ? "pro" : "free",
    status: customer?.subscriptionStatus ?? null,
    cancelAtPeriodEnd: customer?.cancelAtPeriodEnd ?? false,
    periodEnd: customer?.currentPeriodEnd?.toISOString() ?? null,
    taxLocationInvalid: customer?.taxLocationInvalid ?? false,
    hasCustomer: Boolean(customer),
  };
}
