"use client";

import { ChevronRight, Plug, Plus, Settings, Star, Users, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CreateAutomationDialog } from "@/components/automations/create-automation-dialog";
import { StatusDot } from "@/components/automations/status-pill";
import { Wordmark } from "@adeli-chat/ui/brand/wordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@adeli-chat/ui/components/avatar";
import { Button } from "@adeli-chat/ui/components/button";
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
} from "@adeli-chat/ui/components/sidebar";
import type { AdeliAccount } from "@/lib/adeli/types";
import type { Automation } from "@adeli-chat/ui/automation/schemas";
import { cn } from "@adeli-chat/ui/lib/utils";

type AutomationLink = Pick<Automation, "id" | "name" | "status">;

export function AppSidebar({ account, profileName, automations }: { account: AdeliAccount | null; profileName: string | null; automations: AutomationLink[] }) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b p-4">
        <Link href="/automations" aria-label="LedaChat home">
          <Wordmark size="sm" />
        </Link>
      </SidebarHeader>
      {/* New automation, then Automations, then Audience, Connect to AI Agent, Star on GitHub and Settings right below. Only the automation list scrolls. */}
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="shrink-0 pb-0">
          <Button className="w-full justify-start" onClick={() => setCreating(true)}>
            <Plus /> New automation
          </Button>
        </SidebarGroup>
        <SidebarGroup className="min-h-0 py-0">
          <AutomationsNav automations={automations} />
        </SidebarGroup>
        <SidebarGroup className="shrink-0 pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/audience" />} isActive={pathname.startsWith("/audience")}>
                  <Users />
                  <span>Audience</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/mcp-apis" />} isActive={pathname.startsWith("/mcp-apis")}>
                  <Plug />
                  <span>Connect to AI Agent</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="https://github.com/kingscrosslabs/ledachat" target="_blank" rel="noreferrer" />}>
                  <Star />
                  <span>Star on GitHub</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
      <CreateAutomationDialog open={creating} onOpenChange={setCreating} connected={Boolean(account)} />
      <SidebarFooter className="gap-3 border-t p-4">
        {account ? (
          <Link href="/settings" className="flex min-w-0 items-center gap-3 rounded-lg p-1 -m-1 hover:bg-sidebar-accent" aria-label={`Connected Instagram account @${account.displayIdentifier}`}>
            <Avatar size="sm">
              {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
              <AvatarFallback>{account.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">@{account.displayIdentifier}</span>
              <span className="block truncate text-xs text-muted-foreground">via Adeli{profileName ? ` · ${profileName}` : ""}</span>
            </span>
          </Link>
        ) : (
          <Link href="/connect" className="text-sm text-link underline-offset-4 hover:underline">Connect Instagram</Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

/** Automations with its own dropdown of every automation, most recently updated first. */
function AutomationsNav({ automations }: { automations: AutomationLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-0 flex-col">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link href="/automations" />} isActive={pathname === "/automations"}>
            <Zap />
            <span>Automations</span>
          </SidebarMenuButton>
          {automations.length ? (
            <SidebarMenuAction
              aria-label={open ? "Hide automations" : "Show automations"}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
            </SidebarMenuAction>
          ) : null}
        </SidebarMenuItem>
      </SidebarMenu>
      {open && automations.length ? (
        <SidebarMenuSub className="mt-1 min-h-0 overflow-y-auto">
          {automations.map((automation) => (
            <SidebarMenuSubItem key={automation.id}>
              <SidebarMenuSubButton render={<Link href={`/automations/${automation.id}`} />} isActive={pathname === `/automations/${automation.id}`}>
                <StatusDot status={automation.status} />
                <span>{automation.name || "Untitled automation"}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </div>
  );
}
