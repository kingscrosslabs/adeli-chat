import { adeliErrorResponse } from "@/lib/adeli/http";
import { getConnectSession } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const profileId = query.get("profileId");
  const sessionId = query.get("sessionId");
  if (!profileId || !sessionId) {
    return Response.json({ error: { code: "invalid_request", message: "profileId and sessionId are required." } }, { status: 400 });
  }
  try {
    return Response.json(await getConnectSession(profileId, sessionId));
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
