"use client";

import { Guard } from "@/components/guard";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { KeyBanner } from "@/components/shell/key-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Wordmark } from "@/components/brand/wordmark";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard require="session">
      <SidebarProvider>
        <AppSidebar />
        {/* min-w-0: a flex item otherwise grows to its widest content. */}
        <SidebarInset className="min-w-0">
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
            <Wordmark size="sm" />
          </header>
          <KeyBanner />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </Guard>
  );
}
