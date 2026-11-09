import { SettingsView } from "@/components/settings/settings-view";
import { lastKeyState } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getConnectedAccount, listAutomations } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [keyState, account, user] = await Promise.all([lastKeyState(), getConnectedAccount(), getCurrentUser()]);
  const automations = account ? await listAutomations(account.id) : [];
  return <SettingsView keyState={keyState} account={account} user={user} liveCount={automations.filter((automation) => automation.status === "live").length} />;
}
