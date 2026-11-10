import { SettingsView } from "@/components/settings/settings-view";
import { serverKeyRejected } from "@/lib/adeli/client";
import { DEFAULT_BASE_URL, findAdeliConfig } from "@/lib/adeli/key";
import { authEnabled } from "@/lib/auth/config";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount, listAutomations } from "@/lib/data";
import { getUserSettings } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUserPage();
  const [account, settings] = await Promise.all([getConnectedAccount(user.id), getUserSettings(user.id)]);
  const automations = account ? await listAutomations(account.id) : [];
  const config = findAdeliConfig();
  const adeli = { configured: Boolean(config), rejected: serverKeyRejected(), baseURL: config?.baseURL ?? DEFAULT_BASE_URL, profileName: settings.adeliProfileName };
  return <SettingsView adeli={adeli} account={account} user={authEnabled() ? user : null} liveCount={automations.filter((automation) => automation.status === "live").length} />;
}
