"use client";

import { Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Automation } from "@/lib/automations/schemas";
import { errorCount, findConflict, validateForLive } from "@/lib/automations/validate";
import { actions, readDemoState } from "@/lib/demo/store";

/**
 * Go Live from outside the editor: same validation and conflict rules as the
 * editor (FR-7.2, FR-7.3). Anything to fix sends you to the editor.
 */
export function goLive(automation: Automation, openEditor: () => void) {
  const errors = validateForLive(automation);
  const count = errorCount(errors);
  if (count) {
    toast.error(`${count} ${count === 1 ? "thing" : "things"} to fix before going live`, { action: { label: "Open editor", onClick: openEditor } });
    return false;
  }
  const conflict = findConflict(automation, automation.id, readDemoState().automations);
  if (conflict) {
    toast.error(`"${conflict.automation.name}" is already live on this post${conflict.reason === "keyword" ? ` with the keyword ${conflict.keyword?.toUpperCase()}` : " for any comment"}.`);
    return false;
  }
  actions.setStatus(automation.id, "live");
  toast.success(`${automation.name} is live`);
  return true;
}

export function AutomationRowActions({ automation }: { automation: Automation }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editHref = `/automations/${automation.id}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${automation.name}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => router.push(editHref)}><Pencil /> Edit</DropdownMenuItem>
          {automation.status === "live" ? (
            <DropdownMenuItem onClick={() => { actions.setStatus(automation.id, "paused"); toast(`${automation.name} is paused`); }}><Pause /> Pause</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => goLive(automation, () => router.push(`${editHref}?validate=1`))}><Play /> Go Live</DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              const copyId = actions.duplicateAutomation(automation.id);
              if (copyId) toast.success("Duplicated as a Draft", { action: { label: "Edit", onClick: () => router.push(`/automations/${copyId}`) } });
            }}
          >
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAutomationDialog automation={automation} open={confirmDelete} onOpenChange={setConfirmDelete} />
    </>
  );
}

export function DeleteAutomationDialog({ automation, open, onOpenChange, onDeleted }: { automation: Automation; open: boolean; onOpenChange: (open: boolean) => void; onDeleted?: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {automation.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {automation.status === "live" ? "It's live right now. We'll pause it first, so nobody gets a half-finished conversation. " : ""}
            This removes the automation and its stats. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (automation.status === "live") actions.setStatus(automation.id, "paused");
              actions.deleteAutomation(automation.id);
              onOpenChange(false);
              toast(`Deleted ${automation.name}`);
              onDeleted?.();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
