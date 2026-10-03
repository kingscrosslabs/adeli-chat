"use client";

import { LogOut, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { actions, useDemoState } from "@/lib/demo/store";

const navigation = [
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const state = useDemoState();
  const account = state?.account;

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b p-4">
        <Link href="/automations" aria-label="Adeli Chat home">
          <Wordmark size="sm" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />} isActive={pathname.startsWith(item.href)}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t p-4">
        {account ? (
          <Link href="/settings" className="flex min-w-0 items-center gap-3 rounded-lg p-1 -m-1 hover:bg-sidebar-accent" aria-label={`Connected Instagram account @${account.displayIdentifier}`}>
            <Avatar size="sm">
              {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
              <AvatarFallback>{account.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">@{account.displayIdentifier}</span>
              <span className="block truncate text-xs text-muted-foreground">via Adeli · {state?.adeliKey?.profileName}</span>
            </span>
          </Link>
        ) : (
          <Link href="/connect" className="text-sm text-primary underline-offset-4 hover:underline">Connect Instagram</Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            actions.logout();
            router.replace("/login");
          }}
        >
          <LogOut /> Log out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
