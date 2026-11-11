import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { isConnectAuthMethod, startConnect } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

/** Starts connecting Instagram on the signed-in user's own Adeli profile. Body: `{ authMethod?: "instagram_login" | "facebook_login" }`. */
export async function POST(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { authMethod?: unknown } | null;
  const authMethod = body?.authMethod ?? "instagram_login";
  if (!isConnectAuthMethod(authMethod)) {
    return Response.json({ error: { code: "invalid_request", message: "authMethod must be instagram_login or facebook_login." } }, { status: 400 });
  }
  try {
    const appUrl = process.env.APP_URL?.trim() || new URL(request.url).origin;
    const redirectUrl = new URL("/connect", appUrl).toString();
    return Response.json(await startConnect(auth.userId, redirectUrl, authMethod), { status: 201 });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
