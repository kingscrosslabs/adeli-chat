"use client";

import { ChevronRight, LogOut, Plus, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { CreateAutomationDialog } from "@/components/automations/create-automation-dialog";
import { StatusDot } from "@/components/automations/status-pill";
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { actions, byRecency, useDemoState } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

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
              <AutomationsNav />
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/settings" />} isActive={pathname.startsWith("/settings")}>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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

/**
 * Automations with its own dropdown of every automation, most recently
 * updated first. With none yet, the dropdown holds a create button instead.
 */
function AutomationsNav() {
  const pathname = usePathname();
  const state = useDemoState();
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const automations = byRecency(state?.automations ?? []);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={<Link href="/automations" />} isActive={pathname === "/automations"}>
        <Zap />
        <span>Automations</span>
      </SidebarMenuButton>
      <SidebarMenuAction
        aria-label={open ? "Hide automations" : "Show automations"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
      </SidebarMenuAction>
      {open ? (
        <SidebarMenuSub>
          {automations.length === 0 ? (
            <SidebarMenuSubItem>
              <Button variant="outline" size="sm" className="my-1 w-full justify-start bg-background" onClick={() => setCreating(true)}>
                <Plus /> Create automation
              </Button>
            </SidebarMenuSubItem>
          ) : (
            <>
              {automations.map((automation) => (
                <SidebarMenuSubItem key={automation.id}>
                  <SidebarMenuSubButton render={<Link href={`/automations/${automation.id}`} />} isActive={pathname === `/automations/${automation.id}`}>
                    <StatusDot status={automation.status} />
                    <span>{automation.name || "Untitled automation"}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton render={<button type="button" />} className="w-full text-muted-foreground" onClick={() => setCreating(true)}>
                  <Plus />
                  <span>New automation</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </>
          )}
        </SidebarMenuSub>
      ) : null}
      <CreateAutomationDialog open={creating} onOpenChange={setCreating} />
    </SidebarMenuItem>
  );
}
