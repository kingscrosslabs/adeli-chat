import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { startConnect } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

/** Starts Instagram Login on the signed-in user's own Adeli profile. */
export async function POST(request: Request) {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  try {
    const appUrl = process.env.APP_URL?.trim() || new URL(request.url).origin;
    const redirectUrl = new URL("/connect", appUrl).toString();
    return Response.json(await startConnect(auth.userId, redirectUrl), { status: 201 });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
