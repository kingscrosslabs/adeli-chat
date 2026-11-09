import { adeliErrorResponse } from "@/lib/adeli/http";
import { unauthorizedResponse } from "@/lib/auth/session";
import { listInstagramAccounts } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await unauthorizedResponse();
  if (denied) return denied;
  try {
    return Response.json({ accounts: await listInstagramAccounts() });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
