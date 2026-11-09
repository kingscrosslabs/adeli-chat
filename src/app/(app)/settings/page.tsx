import { SettingsView } from "@/components/settings/settings-view";
import { lastKeyState } from "@/lib/actions";
import { authEnabled } from "@/lib/auth/config";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount, listAutomations } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUserPage();
  const [keyState, account] = await Promise.all([lastKeyState(), getConnectedAccount(user.id)]);
  const automations = account ? await listAutomations(account.id) : [];
  return <SettingsView keyState={keyState} account={account} user={authEnabled() ? user : null} liveCount={automations.filter((automation) => automation.status === "live").length} />;
}
