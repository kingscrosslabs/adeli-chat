import { adeliErrorResponse } from "@/lib/adeli/http";
import { listInstagramAccounts } from "@/lib/adeli/server";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json({ accounts: await listInstagramAccounts() });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
