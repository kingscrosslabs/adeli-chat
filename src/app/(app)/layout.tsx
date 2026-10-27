import { AppSidebar } from "@/components/shell/app-sidebar";
import { KeyBanner } from "@/components/shell/key-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Wordmark } from "@/components/brand/wordmark";
import { getAppSettings } from "@/lib/app-settings";
import { getAdeliConfig } from "@/lib/adeli/key";
import { getConnectedAccount, listAutomations } from "@/lib/data";

export const dynamic = "force-dynamic";

function keyProblem(status: "valid" | "invalid" | "unchecked") {
  try {
    getAdeliConfig();
  } catch {
    return "missing" as const;
  }
  return status === "invalid" ? "invalid" as const : null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [account, settings] = await Promise.all([getConnectedAccount(), getAppSettings()]);
  const automations = account ? await listAutomations(account.id) : [];
  return (
    <SidebarProvider>
      <AppSidebar
        account={account}
        profileName={settings.adeliProfileName}
        automations={automations.map(({ id, name, status }) => ({ id, name, status }))}
      />
      {/* min-w-0: a flex item otherwise grows to its widest content. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Wordmark size="sm" />
        </header>
        <KeyBanner problem={keyProblem(settings.adeliKeyStatus)} />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
