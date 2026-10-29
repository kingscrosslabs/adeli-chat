import { AutomationsView } from "@/components/automations/automations-view";
import { listAutomations, requireAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const account = await requireAccount();
  return <AutomationsView automations={await listAutomations(account.id)} />;
}
