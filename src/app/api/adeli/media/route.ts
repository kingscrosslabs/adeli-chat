import { adeliErrorResponse } from "@/lib/adeli/http";
import { listMedia } from "@/lib/adeli/server";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  const query = new URL(request.url).searchParams;
  const accountId = query.get("accountId");
  const page = Number(query.get("page") ?? "0");
  if (!accountId || !Number.isInteger(page) || page < 0) {
    return Response.json({ error: { code: "invalid_request", message: "A valid accountId and page are required." } }, { status: 400 });
  }
  try {
    return Response.json(await listMedia(accountId, page));
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
