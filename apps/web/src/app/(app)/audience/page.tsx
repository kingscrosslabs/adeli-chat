import { AudienceView } from "@/components/audience/audience-view";
import { track } from "@/lib/analytics/server";
import { listAudience, listAutomationPeople } from "@/lib/audience";
import { requireUserPage } from "@/lib/auth/session";
import { listAutomations, requireAccount } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Everyone who triggered the user's automations, or one automation's people with `?automation=<id>`. */
export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ automation?: string }> }) {
  const user = await requireUserPage();
  const account = await requireAccount(user.id);
  const automations = await listAutomations(account.id);
  const { automation: requested } = await searchParams;
  // Only one of the user's own automations; anything else shows everyone.
  const selected = automations.find((automation) => automation.id === requested) ?? null;
  const options = automations.map(({ id, name, type }) => ({ id, name: name || "Untitled automation", type }));

  if (selected) {
    const people = await listAutomationPeople(account.id, selected.id);
    track(user.id, "audience_viewed", { automation_id: selected.id, people: people.length });
    return <AudienceView automations={options} mode={{ kind: "automation", automationId: selected.id, people }} />;
  }
  const contacts = await listAudience(account.id);
  track(user.id, "audience_viewed", { people: contacts.length });
  return <AudienceView automations={options} mode={{ kind: "all", contacts }} />;
}
