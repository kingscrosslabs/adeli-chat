import { AppSidebar } from "@/components/shell/app-sidebar";
import { KeyBanner } from "@/components/shell/key-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Wordmark } from "@/components/brand/wordmark";
import { getAppSettings } from "@/lib/app-settings";
import { findAdeliConfig } from "@/lib/adeli/key";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount, listAutomations } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage();
  const [account, settings, config] = await Promise.all([getConnectedAccount(), getAppSettings(), findAdeliConfig().catch(() => null)]);
  const keyProblem = !config ? "missing" as const : settings.adeliKeyStatus === "invalid" ? "invalid" as const : null;
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
        <KeyBanner problem={keyProblem} />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
