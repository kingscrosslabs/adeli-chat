import { SettingsView } from "@/components/settings/settings-view";
import type { KeyState } from "@/lib/actions";
import { getAppSettings } from "@/lib/app-settings";
import { getAdeliConfig } from "@/lib/adeli/key";
import { adeliKeyPrefix } from "@/lib/adeli/types";
import { getConnectedAccount, listAutomations } from "@/lib/data";

export const dynamic = "force-dynamic";

/** The last recorded key check. "Test connection" asks Adeli again. */
async function lastKeyState(): Promise<KeyState> {
  let apiKey: string;
  try {
    apiKey = getAdeliConfig().apiKey;
  } catch (error) {
    return { configured: false, message: error instanceof Error ? error.message : "ADELI_API_KEY is not set on this server." };
  }
  const settings = await getAppSettings();
  return {
    configured: true,
    prefix: adeliKeyPrefix(apiKey),
    status: settings.adeliKeyStatus,
    profileName: settings.adeliProfileName,
    checkedAt: settings.adeliKeyCheckedAt?.toISOString() ?? null,
    message: null,
  };
}

export default async function SettingsPage() {
  const [keyState, account] = await Promise.all([lastKeyState(), getConnectedAccount()]);
  const automations = account ? await listAutomations(account.id) : [];
  return <SettingsView keyState={keyState} account={account} liveCount={automations.filter((automation) => automation.status === "live").length} />;
}
