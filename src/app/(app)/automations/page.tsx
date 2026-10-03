"use client";

import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AutomationRowActions } from "@/components/automations/automation-actions";
import { CreateAutomationDialog } from "@/components/automations/create-automation-dialog";
import { PostThumb } from "@/components/automations/post-thumb";
import { StatusPill } from "@/components/automations/status-pill";
import { Guard } from "@/components/guard";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import type { Automation } from "@/lib/automations/schemas";
import { triggerSummary } from "@/lib/automations/validate";
import { useDemoState } from "@/lib/demo/store";
import { compactNumber, relativeTime } from "@/lib/format";

export default function AutomationsPage() {
  return (
    <Guard require="ready">
      <AutomationsView />
    </Guard>
  );
}

function AutomationsView() {
  const state = useDemoState();
  const [creating, setCreating] = useState(false);
  const automations = state?.automations ?? [];

  const createButton = (
    <Button size="lg" onClick={() => setCreating(true)}>
      <Plus /> Create automation
    </Button>
  );

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeading title="Automations" description="Reply to comments and send DMs while you get on with your day." action={automations.length ? createButton : null} />
      {automations.length === 0 ? (
        <EmptyState action={createButton} />
      ) : (
        <>
          <AutomationsTable automations={automations} />
          <AutomationsCards automations={automations} />
        </>
      )}
      <CreateAutomationDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function EmptyState({ action }: { action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><MessageCircle className="size-5" /></span>
      <div>
        <h2 className="text-base font-semibold">No automations yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">When someone comments a keyword on your post, we&apos;ll reply and send them your link in a DM.</p>
      </div>
      {action}
    </div>
  );
}

function AutomationsTable({ automations }: { automations: Automation[] }) {
  return (
    <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Automation</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Trigger</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Triggered</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Final DMs sent</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Updated</th>
            <th scope="col" className="w-12 px-2 py-2.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {automations.map((automation) => (
            <tr key={automation.id} className="transition-colors hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link href={`/automations/${automation.id}`} className="flex items-center gap-3 font-medium outline-none hover:underline focus-visible:underline">
                  <PostThumb src={automation.trigger.mediaSnapshot?.thumbUrl} className="size-10 shrink-0 rounded-md" />
                  <span className="truncate">{automation.name}</span>
                </Link>
              </td>
              <td className="max-w-48 truncate px-4 py-3 text-muted-foreground">{triggerSummary(automation)}</td>
              <td className="px-4 py-3"><StatusPill status={automation.status} /></td>
              <td className="px-4 py-3 text-right tabular-nums">{compactNumber(automation.stats.triggered)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{compactNumber(automation.stats.finalDms)}</td>
              <td className="px-4 py-3 text-muted-foreground">{relativeTime(automation.updatedAt)}</td>
              <td className="px-2 py-3"><AutomationRowActions automation={automation} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutomationsCards({ automations }: { automations: Automation[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {automations.map((automation) => (
        <li key={automation.id} className="flex gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <PostThumb src={automation.trigger.mediaSnapshot?.thumbUrl} className="size-14 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/automations/${automation.id}`} className="truncate font-medium hover:underline">{automation.name}</Link>
              <StatusPill status={automation.status} />
            </div>
            <p className="truncate text-xs text-muted-foreground">{triggerSummary(automation)}</p>
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums text-foreground">{compactNumber(automation.stats.triggered)}</span> triggered ·{" "}
              <span className="tabular-nums text-foreground">{compactNumber(automation.stats.finalDms)}</span> final DMs · {relativeTime(automation.updatedAt)}
            </p>
          </div>
          <AutomationRowActions automation={automation} />
        </li>
      ))}
    </ul>
  );
}
