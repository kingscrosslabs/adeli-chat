import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { startConnect } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as { profileId?: unknown };
    if (typeof body.profileId !== "string" || !body.profileId) {
      return Response.json({ error: { code: "invalid_request", message: "Choose an Adeli profile first." } }, { status: 400 });
    }
    const appUrl = process.env.APP_URL?.trim() || new URL(request.url).origin;
    const redirectUrl = new URL("/connect", appUrl).toString();
    return Response.json(await startConnect(auth.userId, body.profileId, redirectUrl), { status: 201 });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
