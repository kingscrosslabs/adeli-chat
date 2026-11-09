import { adeliErrorResponse } from "@/lib/adeli/http";
import { userOrUnauthorized } from "@/lib/auth/session";
import { listInstagramAccounts } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await userOrUnauthorized();
  if ("response" in auth) return auth.response;
  try {
    return Response.json({ accounts: await listInstagramAccounts(auth.userId) });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
