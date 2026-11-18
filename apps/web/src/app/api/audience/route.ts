import { track } from "@/lib/analytics/server";
import { audienceCsv, automationPeopleCsv, listAudience, listAutomationPeople } from "@/lib/audience";
import { userOrUnauthorized } from "@/lib/auth/session";
import { requireAccount, ServiceError } from "@/lib/automations/service";
import { getAutomation } from "@/lib/data";

export const dynamic = "force-dynamic";

const CSV_HEADERS = { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store" };

/** The Audience as a CSV download: everyone, or one automation's people with `?automation=<id>`. */
export async function GET(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  try {
    const account = await requireAccount(auth.userId);
    const automationId = new URL(request.url).searchParams.get("automation");
    if (automationId) {
      // Only the user's own automation.
      const automation = await getAutomation(account.id, automationId);
      if (!automation) return Response.json({ error: { code: "not_found", message: "There's no automation with that id." } }, { status: 404 });
      const people = await listAutomationPeople(account.id, automation.id);
      track(auth.userId, "audience_exported", { automation_id: automation.id, people: people.length });
      const slug = automation.name.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "automation";
      return new Response(automationPeopleCsv(people), { headers: { ...CSV_HEADERS, "Content-Disposition": `attachment; filename="${slug}-people.csv"` } });
    }
    const contacts = await listAudience(account.id);
    track(auth.userId, "audience_exported", { people: contacts.length });
    return new Response(audienceCsv(contacts), { headers: { ...CSV_HEADERS, "Content-Disposition": `attachment; filename="audience.csv"` } });
  } catch (error) {
    if (error instanceof ServiceError) return Response.json({ error: { code: "not_found", message: error.message } }, { status: 404 });
    throw error;
  }
}
