import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { getConnectSession } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

/** A connection session on the signed-in user's own Adeli profile. */
export async function GET(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: { code: "invalid_request", message: "sessionId is required." } }, { status: 400 });
  }
  try {
    return Response.json(await getConnectSession(auth.userId, sessionId));
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
