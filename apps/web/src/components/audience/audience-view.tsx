"use client";

import { Download, ExternalLink, Loader2, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StagePill } from "@/components/audience/stage-pill";
import { PageHeading } from "@/components/page-heading";
import { Avatar, AvatarFallback } from "@adeli-chat/ui/components/avatar";
import { buttonVariants } from "@adeli-chat/ui/components/button";
import { Input } from "@adeli-chat/ui/components/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@adeli-chat/ui/components/sheet";
import { getContactRuns } from "@/lib/actions";
import type { AudienceContact, AutomationPerson, ContactRun } from "@/lib/audience";
import { compactNumber, relativeTime, shortDate } from "@/lib/format";

type AutomationOption = { id: string; name: string; type: "comment_to_dm" | "story_reply" };
type Mode =
  | { kind: "all"; contacts: AudienceContact[] }
  | { kind: "automation"; automationId: string; people: AutomationPerson[] };
type Person = { igUserId: string; igUsername: string | null };
type Sort = "engaged" | "recent";

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function handleOf(person: Person) {
  return person.igUsername ? `@${person.igUsername}` : "Unknown handle";
}

function matches(person: Person & { email?: string | null }, query: string) {
  if (!query) return true;
  const needle = query.toLowerCase().replace(/^@/, "");
  return Boolean(person.igUsername?.toLowerCase().includes(needle) || person.email?.toLowerCase().includes(needle));
}

/** The Audience page: everyone across the user's automations, or one automation's people. */
export function AudienceView({ automations, mode }: { automations: AutomationOption[]; mode: Mode }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("engaged");
  const [open, setOpen] = useState<Person | null>(null);
  const automationId = mode.kind === "automation" ? mode.automationId : null;
  const exportHref = automationId ? `/api/audience?automation=${encodeURIComponent(automationId)}` : "/api/audience";
  const total = mode.kind === "all" ? mode.contacts.length : mode.people.length;

  const contacts = useMemo(() => {
    if (mode.kind !== "all") return [];
    const found = mode.contacts.filter((contact) => matches(contact, query));
    return sort === "recent" ? [...found].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)) : found;
  }, [mode, query, sort]);
  const people = useMemo(() => (mode.kind === "automation" ? mode.people.filter((person) => matches(person, query)) : []), [mode, query]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeading
        title="Audience"
        description={automationId ? "Everyone who triggered this automation, newest first." : "Everyone who triggered your automations, most engaged first."}
        action={total ? <a href={exportHref} download className={buttonVariants({ variant: "outline" })}><Download /> Export CSV</a> : null}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label="Automation"
          className={SELECT_CLASS}
          value={automationId ?? ""}
          onChange={(event) => router.push(event.target.value ? `/audience?automation=${encodeURIComponent(event.target.value)}` : "/audience")}
        >
          <option value="">All automations</option>
          {automations.map((automation) => <option key={automation.id} value={automation.id}>{automation.name}</option>)}
        </select>
        {mode.kind === "all" ? (
          <select aria-label="Sort" className={SELECT_CLASS} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="engaged">Most engaged</option>
            <option value="recent">Most recent</option>
          </select>
        ) : null}
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search handle or email" aria-label="Search" className="pl-8" />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState filtered={Boolean(automationId)} />
      ) : mode.kind === "all" ? (
        <>
          <Summary items={[
            { label: "People", value: mode.contacts.length },
            { label: "Triggered 2+ automations", value: mode.contacts.filter((contact) => contact.automations > 1).length },
            { label: "Got a Final DM", value: mode.contacts.filter((contact) => contact.finalDms > 0).length },
            { label: "Gave an email", value: mode.contacts.filter((contact) => contact.email).length },
          ]} />
          <ContactsTable contacts={contacts} onOpen={setOpen} />
        </>
      ) : (
        <>
          <Summary items={[
            { label: "People", value: mode.people.length },
            { label: "Tapped the button", value: mode.people.filter((person) => !["matched", "opening_sent", "failed"].includes(person.stage)).length },
            { label: "Got the Final DM", value: mode.people.filter((person) => person.stage === "final_sent").length },
            { label: "Gave an email", value: mode.people.filter((person) => person.email).length },
          ]} />
          <PeopleTable people={people} onOpen={setOpen} />
        </>
      )}
      {total > 0 && (mode.kind === "all" ? contacts.length : people.length) === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Nobody matches &ldquo;{query}&rdquo;.</p>
      ) : null}

      <ContactSheet person={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><Users className="size-5" /></span>
      <div>
        <h2 className="text-base font-semibold">{filtered ? "Nobody has triggered this automation yet" : "No audience yet"}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {filtered ? "People show up here as soon as they comment or reply and the automation starts." : "When people trigger your automations, they show up here so you can see who engages the most."}
        </p>
      </div>
      {filtered ? null : <Link href="/automations" className={buttonVariants({ variant: "outline" })}>Go to automations</Link>}
    </div>
  );
}

function Summary({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{compactNumber(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PersonCell({ person, onOpen }: { person: Person; onOpen: (person: Person) => void }) {
  return (
    <button type="button" onClick={() => onOpen(person)} className="flex min-w-0 items-center gap-3 text-left font-medium outline-none hover:underline focus-visible:underline">
      <Avatar size="sm">
        <AvatarFallback>{(person.igUsername ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="truncate">{handleOf(person)}</span>
    </button>
  );
}

const TH = "px-4 py-2.5 font-medium whitespace-nowrap";

function ContactsTable({ contacts, onOpen }: { contacts: AudienceContact[]; onOpen: (person: Person) => void }) {
  if (!contacts.length) return null;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className={TH}>Person</th>
              <th scope="col" className={`${TH} text-right`}>Automations</th>
              <th scope="col" className={`${TH} text-right`}>Button taps</th>
              <th scope="col" className={`${TH} text-right`}>Final DMs</th>
              <th scope="col" className={TH}>Email</th>
              <th scope="col" className={TH}>Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {contacts.map((contact) => (
              <tr key={contact.igUserId} className="transition-colors hover:bg-muted/40">
                <td className="max-w-64 px-4 py-3"><PersonCell person={contact} onOpen={onOpen} /></td>
                <td className="px-4 py-3 text-right tabular-nums">{compactNumber(contact.automations)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{compactNumber(contact.buttonTaps)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{compactNumber(contact.finalDms)}</td>
                <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">{contact.email ?? ""}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{relativeTime(contact.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {contacts.map((contact) => (
          <li key={contact.igUserId} className="space-y-1.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <PersonCell person={contact} onOpen={onOpen} />
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums text-foreground">{contact.automations}</span> {contact.automations === 1 ? "automation" : "automations"} ·{" "}
              <span className="tabular-nums text-foreground">{contact.finalDms}</span> {contact.finalDms === 1 ? "final DM" : "final DMs"} · {relativeTime(contact.lastSeenAt)}
            </p>
            {contact.email ? <p className="truncate text-xs text-muted-foreground">{contact.email}</p> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function PeopleTable({ people, onOpen }: { people: AutomationPerson[]; onOpen: (person: Person) => void }) {
  if (!people.length) return null;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className={TH}>Person</th>
              <th scope="col" className={TH}>Stage</th>
              <th scope="col" className={TH}>Comment</th>
              <th scope="col" className={TH}>Email</th>
              <th scope="col" className={TH}>Triggered</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {people.map((person) => (
              <tr key={person.igUserId} className="transition-colors hover:bg-muted/40">
                <td className="max-w-56 px-4 py-3"><PersonCell person={person} onOpen={onOpen} /></td>
                <td className="px-4 py-3"><StagePill stage={person.stage} /></td>
                <td className="max-w-64 truncate px-4 py-3 text-muted-foreground" title={person.commentText ?? undefined}>{person.commentText ?? ""}</td>
                <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">{person.email ?? ""}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{relativeTime(person.triggeredAt)}{person.source === "earlier" ? " · earlier comment" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {people.map((person) => (
          <li key={person.igUserId} className="space-y-1.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-2">
              <PersonCell person={person} onOpen={onOpen} />
              <StagePill stage={person.stage} />
            </div>
            {person.commentText ? <p className="truncate text-xs text-muted-foreground">&ldquo;{person.commentText}&rdquo;</p> : null}
            <p className="text-xs text-muted-foreground">{relativeTime(person.triggeredAt)}{person.email ? ` · ${person.email}` : ""}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** One person's detail: every automation they triggered, read when opened. */
function ContactSheet({ person, onClose }: { person: Person | null; onClose: () => void }) {
  // Keyed by person, so opening someone else shows loading until their runs arrive.
  const [loaded, setLoaded] = useState<{ igUserId: string; runs: ContactRun[] | null } | null>(null);
  const igUserId = person?.igUserId ?? null;

  useEffect(() => {
    if (!igUserId) return;
    let cancelled = false;
    void getContactRuns(igUserId).then((result) => {
      if (!cancelled) setLoaded({ igUserId, runs: result.ok ? result.runs : null });
    });
    return () => { cancelled = true; };
  }, [igUserId]);

  const current = loaded && loaded.igUserId === igUserId ? loaded : null;
  const runs = current?.runs ?? null;
  const failed = Boolean(current && !current.runs);

  const handle = runs?.find((run) => run.igUsername)?.igUsername ?? person?.igUsername ?? null;
  const email = runs?.find((run) => run.email)?.email ?? null;

  return (
    <Sheet open={person !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{handle ? `@${handle}` : "Unknown handle"}</SheetTitle>
          <SheetDescription>
            {runs ? `Triggered ${runs.length} ${runs.length === 1 ? "automation" : "automations"}` : "Loading their history"}
            {email ? ` · ${email}` : ""}
          </SheetDescription>
          {handle ? (
            <a href={`https://www.instagram.com/${encodeURIComponent(handle)}/`} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-sm text-link underline-offset-4 hover:underline">
              Open on Instagram <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </SheetHeader>
        <div className="px-4 pb-6">
          {failed ? (
            <p className="text-sm text-destructive">Couldn&apos;t load their history. Try again.</p>
          ) : !runs ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : (
            <ol className="space-y-3">
              {runs.map((run) => (
                <li key={run.automationId} className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/automations/${run.automationId}`} className="min-w-0 truncate text-sm font-medium hover:underline">{run.automationName || "Untitled automation"}</Link>
                    <StagePill stage={run.stage} />
                  </div>
                  {run.commentText ? (
                    <p className="text-sm text-muted-foreground">
                      {run.automationType === "story_reply" ? "Replied" : "Commented"} &ldquo;{run.commentText}&rdquo;
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{shortDate(run.triggeredAt)}{run.source === "earlier" ? " · from an earlier comment" : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
