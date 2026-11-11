import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { listStories } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  const accountId = new URL(request.url).searchParams.get("accountId");
  if (!accountId) return Response.json({ error: { code: "invalid_request", message: "An accountId is required." } }, { status: 400 });
  try {
    return Response.json({ stories: await listStories(auth.userId, accountId) });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
