import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { listMedia } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams;
  const accountId = query.get("accountId");
  const page = Number(query.get("page") ?? "0");
  if (!accountId || !Number.isInteger(page) || page < 0) {
    return Response.json({ error: { code: "invalid_request", message: "A valid accountId and page are required." } }, { status: 400 });
  }
  try {
    return Response.json(await listMedia(auth.userId, accountId, page));
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
