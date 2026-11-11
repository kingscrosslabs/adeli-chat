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
import { deleteAutomation, duplicateAutomation, goLive as goLiveAction, pauseAutomation, resetRuns, type ActionResult } from "@/lib/actions";
import { errorCount, validateForLive } from "@/lib/automations/validate";

/**
 * Go Live from outside the editor: same validation and conflict rules as the
 * editor (FR-7.2, FR-7.3). Anything to fix sends you to the editor.
 */
export async function goLive(automation: Automation, openEditor: () => void) {
  const count = errorCount(validateForLive(automation));
  if (count) {
    toast.error(`${count} ${count === 1 ? "thing" : "things"} to fix before going live`, { action: { label: "Open editor", onClick: openEditor } });
    return false;
  }
  const result = await goLiveAction(automation.id);
  if (!result.ok) {
    if (result.reason === "invalid") toast.error(`${result.count} ${result.count === 1 ? "thing" : "things"} to fix before going live`, { action: { label: "Open editor", onClick: openEditor } });
    else toast.error(result.message);
    return false;
  }
  toast.success(`${automation.name} is live`);
  return true;
}

/** The message for a failed action, for the actions that can only fail with an error. */
function failure(result: ActionResult) {
  return !result.ok && result.reason !== "invalid" ? result.message : "Something went wrong. Try again.";
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
            <DropdownMenuItem onClick={async () => { const result = await pauseAutomation(automation.id); if (result.ok) toast(`${automation.name} is paused`); else toast.error(failure(result)); }}><Pause /> Pause</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => void goLive(automation, () => router.push(`${editHref}?validate=1`))}><Play /> Go Live</DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={async () => {
              const result = await duplicateAutomation(automation.id);
              if (result.ok) toast.success("Duplicated as a Draft", { action: { label: "Edit", onClick: () => router.push(`/automations/${result.id}`) } });
              else toast.error(failure(result));
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
            onClick={async () => {
              const result = await deleteAutomation(automation.id);
              onOpenChange(false);
              if (!result.ok) {
                toast.error(failure(result));
                return;
              }
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

export function ResetRunsDialog({ automation, open, onOpenChange }: { automation: Automation; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset runs for {automation.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Each person gets this flow only once. Resetting forgets everyone it has messaged, so they can trigger it again, and sets its stats back to zero. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              const result = await resetRuns(automation.id);
              onOpenChange(false);
              if (!result.ok) {
                toast.error(failure(result));
                return;
              }
              toast(`Reset ${result.count} ${result.count === 1 ? "run" : "runs"}`);
            }}
          >
            Reset runs
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
