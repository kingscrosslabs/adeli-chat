import Link from "next/link";

import { AutomationEditor } from "@/components/editor/automation-editor";
import { buttonVariants } from "@/components/ui/button";
import { getAutomation, requireAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount();
  const automation = await getAutomation(account.id, id);
  if (!automation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">This automation doesn&apos;t exist</h1>
        <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        <Link href="/automations" className={buttonVariants({ variant: "outline" })}>Back to automations</Link>
      </div>
    );
  }
  // Keyed by id so switching automations resets the draft.
  return <AutomationEditor key={automation.id} automation={automation} account={account} />;
}
