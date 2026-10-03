"use client";

import { ArrowLeft, Loader2, MoreHorizontal, Pause, Play, Smartphone, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DeleteAutomationDialog } from "@/components/automations/automation-actions";
import { StatusPill } from "@/components/automations/status-pill";
import { PhonePreview } from "@/components/preview/phone-preview";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LIMITS, type Automation, type AutomationContent } from "@/lib/automations/schemas";
import { errorCount, findConflict, firstErrorField, validateForLive, type FieldErrors } from "@/lib/automations/validate";
import { actions, readDemoState, useDemoState } from "@/lib/demo/store";
import { compactNumber, relativeTime } from "@/lib/format";

import type { PreviewTab } from "./fields";
import { FinalDmSection, OpeningDmSection, PostSection, ReplySection, TriggerSection } from "./sections";

function contentOf(automation: Automation): AutomationContent {
  const { name, trigger, commentReply, openingDm, finalDm } = automation;
  return structuredClone({ name, trigger, commentReply, openingDm, finalDm });
}

function scrollToField(errors: FieldErrors) {
  const field = firstErrorField(errors);
  if (!field) return;
  const element = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  element?.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
}

/**
 * Split-screen editor (FR-4.x). Left: the form. Right: a sticky phone
 * preview. Below 1024px the preview moves into a drawer.
 */
export function AutomationEditor({ automation }: { automation: Automation }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useDemoState();
  const account = state?.account ?? null;
  const [draft, setDraft] = useState<AutomationContent>(() => contentOf(automation));
  const [validating, setValidating] = useState(() => searchParams.get("validate") === "1");
  const [tab, setTab] = useState<PreviewTab>("post");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<"save" | "live" | null>(null);
  const [, setTick] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const saved = contentOf(automation);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors: FieldErrors = validating ? validateForLive(draft) : {};
  const isLive = automation.status === "live";

  const patch = useCallback((update: (current: AutomationContent) => AutomationContent) => setDraft((current) => update(current)), []);

  // Keep "Saved 2m ago" fresh.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Arriving from the list's Go Live with things to fix.
  useEffect(() => {
    if (searchParams.get("validate") !== "1") return;
    const timer = setTimeout(() => scrollToField(validateForLive(contentOf(automation))), 300);
    return () => clearTimeout(timer);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FR-4.3: warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function rejectForLive(found: FieldErrors) {
    setValidating(true);
    const count = errorCount(found);
    toast.error(`${count} ${count === 1 ? "thing" : "things"} to fix before going live`);
    scrollToField(found);
  }

  function conflictOrNull() {
    const conflict = findConflict(draft, automation.id, readDemoState().automations);
    if (!conflict) return false;
    const detail = conflict.reason === "keyword" ? `also uses the keyword ${conflict.keyword?.toUpperCase()}` : "already answers comments on this post";
    toast.error(`"${conflict.automation.name}" is live on this post and ${detail}.`, {
      description: "Pause it, or change your keywords, so each comment only triggers one automation.",
      action: { label: "Open it", onClick: () => router.push(`/automations/${conflict.automation.id}`) },
    });
    return true;
  }

  async function save() {
    if (isLive) {
      // FR-7.2: Save while Live runs full validation. On failure the live version is untouched.
      const found = validateForLive(draft);
      if (errorCount(found)) return rejectForLive(found);
      if (conflictOrNull()) return;
    }
    setBusy("save");
    await new Promise((resolve) => setTimeout(resolve, 350));
    actions.saveAutomation(automation.id, draft);
    setBusy(null);
    toast.success(isLive ? "Saved. Your changes are live." : "Saved");
  }

  async function goLive() {
    const found = validateForLive(draft);
    if (errorCount(found)) return rejectForLive(found);
    if (conflictOrNull()) return;
    setBusy("live");
    await new Promise((resolve) => setTimeout(resolve, 450));
    actions.saveAutomation(automation.id, draft);
    actions.setStatus(automation.id, "live");
    setBusy(null);
    setValidating(false);
    toast.success("You're live!", { description: "New comments on your post will get a reply and a DM." });
  }

  function pause() {
    actions.setStatus(automation.id, "paused");
    toast("Paused", { description: "New comments won't trigger it. People already waiting on a tap still get their link." });
  }

  // FR-4.3: Cmd/Ctrl+S saves.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function navigate(href: string) {
    if (dirty) setLeaveTo(href);
    else router.push(href);
  }

  const preview = <PhonePreview content={draft} account={account} tab={tab} onTabChange={setTab} />;
  const sectionProps = { draft, patch, errors, onFocusTab: setTab };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
          <Button variant="ghost" size="icon-sm" aria-label="Back to automations" onClick={() => navigate("/automations")}>
            <ArrowLeft />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5" data-field="name">
            <input
              ref={nameRef}
              value={draft.name}
              maxLength={LIMITS.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              aria-label="Automation name"
              aria-invalid={Boolean(errors.name)}
              className="min-w-0 max-w-sm flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-lg font-semibold outline-none hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              placeholder="Name this automation"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs whitespace-nowrap text-muted-foreground sm:inline" aria-live="polite">
              {dirty ? <span className="font-medium text-warning">Unsaved changes</span> : `Saved ${relativeTime(automation.updatedAt)}`}
            </span>
            <StatusPill status={automation.status} className="mr-1" />
            <Button variant="outline" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
              <Smartphone /> Preview
            </Button>
            <Button variant="outline" onClick={() => void save()} disabled={busy !== null || (!dirty && !isLive)} title="Save (Cmd+S)">
              {busy === "save" ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
            {isLive ? (
              <Button size="lg" variant="secondary" onClick={pause}><Pause /> Pause</Button>
            ) : (
              <Button size="lg" onClick={() => void goLive()} disabled={busy !== null}>
                {busy === "live" ? <Loader2 className="animate-spin" /> : <Play />} Go Live
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}><Trash2 /> Delete automation</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {errors.name ? <p className="px-4 pb-2 text-xs text-destructive md:px-6">{errors.name}</p> : null}
        {automation.status !== "draft" ? <StatsRow automation={automation} /> : null}
      </header>

      <div className="grid flex-1 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <div className="space-y-4 p-4 md:p-6">
          {isLive && dirty ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">This automation is live. Saving applies your changes right away.</p>
          ) : null}
          <PostSection {...sectionProps} accountId={account?.accountId ?? ""} />
          <TriggerSection {...sectionProps} />
          <ReplySection {...sectionProps} />
          <OpeningDmSection {...sectionProps} />
          <FinalDmSection {...sectionProps} />
          <div className="h-16" aria-hidden />
        </div>
        <aside className="hidden border-l bg-brand-fog/50 lg:block" aria-label="Live preview">
          <div className="sticky top-28 flex justify-center p-6">{preview}</div>
        </aside>
      </div>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader><SheetTitle>Preview</SheetTitle></SheetHeader>
          <div className="flex justify-center pb-6">{preview}</div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={leaveTo !== null} onOpenChange={(open) => { if (!open) setLeaveTo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes to {draft.name || "this automation"}. They&apos;ll be lost if you leave now.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { const href = leaveTo; setLeaveTo(null); if (href) router.push(href); }}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteAutomationDialog automation={automation} open={deleting} onOpenChange={setDeleting} onDeleted={() => router.push("/automations")} />
    </div>
  );
}

/** FR-10.1: basic counts, no charts. */
function StatsRow({ automation }: { automation: Automation }) {
  const { stats } = automation;
  const items = [
    { label: "Triggered", value: stats.triggered },
    { label: "Comment replies", value: stats.commentReplies },
    { label: "Opening DMs", value: stats.openingDms },
    { label: "Button taps", value: stats.buttonTaps },
    { label: "Final DMs", value: stats.finalDms },
  ];
  return (
    <dl className="flex gap-6 overflow-x-auto border-t px-4 py-2 text-xs md:px-6">
      {items.map((item) => (
        <div key={item.label} className="flex shrink-0 items-baseline gap-1.5">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-semibold tabular-nums">{compactNumber(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
