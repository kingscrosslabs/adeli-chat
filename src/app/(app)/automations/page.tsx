import { AutomationsView } from "@/components/automations/automations-view";
import { requireUserPage } from "@/lib/auth/session";
import { listAutomations, requireAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const user = await requireUserPage();
  const account = await requireAccount(user.id);
  return <AutomationsView automations={await listAutomations(account.id)} />;
}
