import { adeliErrorResponse } from "@/lib/adeli/http";
import { startConnect } from "@/lib/adeli/server";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { profileId?: unknown; authMethod?: unknown };
    if (typeof body.profileId !== "string" || !body.profileId) {
      return Response.json({ error: { code: "invalid_request", message: "Choose an Adeli profile first." } }, { status: 400 });
    }
    if (body.authMethod !== "instagram_login" && body.authMethod !== "facebook_login") {
      return Response.json({ error: { code: "invalid_request", message: "Choose a supported Instagram login method." } }, { status: 400 });
    }
    const appUrl = process.env.APP_URL?.trim() || new URL(request.url).origin;
    const redirectUrl = new URL("/connect", appUrl).toString();
    return Response.json(await startConnect(body.profileId, body.authMethod, redirectUrl), { status: 201 });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
