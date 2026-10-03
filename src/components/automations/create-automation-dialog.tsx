"use client";

import { AtSign, BookOpenText, MessageCircle, MessagesSquare, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { actions, useDemoState } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

type Template = { id: string; title: string; description: string; icon: LucideIcon; enabled: boolean };

/** FR-3.1 copy, verbatim. */
const TEMPLATES: Template[] = [
  { id: "comment_to_dm", title: "Comment to DM", description: "Send a DM when someone comments a keyword on your post", icon: MessageCircle, enabled: true },
  { id: "direct_message", title: "Direct Message", description: "Reply instantly when someone DMs you on autopilot", icon: MessagesSquare, enabled: false },
  { id: "story_reply", title: "Story Reply", description: "Send a follow-up DM when someone replies to your story", icon: BookOpenText, enabled: false },
  { id: "story_mention", title: "Story Mention", description: "Reply automatically when someone mentions you in their story", icon: AtSign, enabled: false },
];

export function CreateAutomationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const state = useDemoState();
  const connected = Boolean(state?.account);

  function create() {
    const id = actions.createAutomation();
    onOpenChange(false);
    router.push(`/automations/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Create automation</DialogTitle>
          <DialogDescription>Pick what should start the conversation.</DialogDescription>
        </DialogHeader>
        {!connected ? (
          <div className="rounded-lg bg-warning-wash px-4 py-3 text-sm text-warning">
            Connect an Instagram account first. <Link href="/connect" className="font-semibold underline underline-offset-4">Connect Instagram</Link>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((template) => {
            const enabled = template.enabled && connected;
            const body = (
              <>
                <span className={cn("grid size-9 place-items-center rounded-lg", template.enabled ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>
                  <template.icon className="size-4" />
                </span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {template.title}
                  {!template.enabled ? <Badge variant="outline" className="font-medium text-muted-foreground">Coming soon</Badge> : null}
                </span>
                <span className="text-sm text-muted-foreground">{template.description}</span>
              </>
            );
            if (!template.enabled) {
              return (
                <div key={template.id} aria-disabled className="flex flex-col items-start gap-2 rounded-xl p-4 opacity-60 ring-1 ring-foreground/10">
                  {body}
                </div>
              );
            }
            return (
              <button
                key={template.id}
                type="button"
                disabled={!enabled}
                onClick={create}
                className="flex flex-col items-start gap-2 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition outline-none hover:ring-2 hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 disabled:hover:ring-1 disabled:hover:ring-foreground/10"
              >
                {body}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          More triggers are on the way. <Link href="https://github.com/kingscrosslabs/adeli-chat" target="_blank" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 text-xs")}>Follow along on GitHub</Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
