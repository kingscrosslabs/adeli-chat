import { track } from "@/lib/analytics/server";
import { userOrUnauthorized } from "@/lib/auth/session";
import { leadsCsv, listLeads, ServiceError } from "@/lib/automations/service";

export const dynamic = "force-dynamic";

/** The automation's leads as a CSV download (Export leads in the editor's menu). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    const { automation, leads } = await listLeads(auth.userId, id);
    track(auth.userId, "leads_exported", { automation_id: id, lead_count: leads.length });
    const filename = `${automation.name.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "automation"}-leads.csv`;
    return new Response(leadsCsv(leads), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ServiceError) return Response.json({ error: { code: "not_found", message: error.message } }, { status: 404 });
    throw error;
  }
}
