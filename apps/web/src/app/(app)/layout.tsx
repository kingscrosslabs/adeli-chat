import { AppSidebar } from "@/components/shell/app-sidebar";
import { KeyBanner } from "@/components/shell/key-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@adeli-chat/ui/components/sidebar";
import { Wordmark } from "@adeli-chat/ui/brand/wordmark";
import { serverKeyRejected } from "@/lib/adeli/client";
import { findAdeliConfig } from "@/lib/adeli/key";
import { requireUserPage } from "@/lib/auth/session";
import { getConnectedAccount, listAutomations } from "@/lib/data";
import { getUserSettings } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  const [account, settings] = await Promise.all([getConnectedAccount(user.id), getUserSettings(user.id)]);
  const keyProblem = !findAdeliConfig() ? "missing" as const : serverKeyRejected() ? "invalid" as const : null;
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
