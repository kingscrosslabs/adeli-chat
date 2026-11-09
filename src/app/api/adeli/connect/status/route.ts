import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { getConnectSession } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams;
  const profileId = query.get("profileId");
  const sessionId = query.get("sessionId");
  if (!profileId || !sessionId) {
    return Response.json({ error: { code: "invalid_request", message: "profileId and sessionId are required." } }, { status: 400 });
  }
  try {
    return Response.json(await getConnectSession(auth.userId, profileId, sessionId));
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
