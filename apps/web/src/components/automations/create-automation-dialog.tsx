"use client";

import { BookOpenText, MessageCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@adeli-chat/ui/components/dialog";
import { createAutomation } from "@/lib/actions";
import type { AutomationType } from "@adeli-chat/ui/automation/schemas";

type Template = { id: AutomationType; title: string; description: string; icon: LucideIcon };

/** FR-3.1 copy, verbatim. Only the triggers that work today are listed. */
const TEMPLATES: Template[] = [
  { id: "comment_to_dm", title: "Comment to DM", description: "Send a DM when someone comments a keyword on your post", icon: MessageCircle },
  { id: "story_reply", title: "Story Reply", description: "Send a follow-up DM when someone replies to your story", icon: BookOpenText },
];

export function CreateAutomationDialog({ open, onOpenChange, connected }: { open: boolean; onOpenChange: (open: boolean) => void; connected: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function create(type: AutomationType) {
    startTransition(async () => {
      const result = await createAutomation(type);
      if (!result.ok) {
        toast.error(result.reason === "error" ? result.message : "We couldn't create the automation. Try again.");
        return;
      }
      onOpenChange(false);
      router.push(`/automations/${result.id}`);
    });
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
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={!connected || pending}
              onClick={() => create(template.id)}
              className="flex flex-col items-start gap-2 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition outline-none hover:ring-2 hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 disabled:hover:ring-1 disabled:hover:ring-foreground/10"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <template.icon className="size-4" />
              </span>
              <span className="text-sm font-semibold">{template.title}</span>
              <span className="text-sm text-muted-foreground">{template.description}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
