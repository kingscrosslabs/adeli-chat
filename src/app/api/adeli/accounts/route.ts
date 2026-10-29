import { adeliErrorResponse } from "@/lib/adeli/http";
import { listInstagramAccounts } from "@/lib/adeli/instagram";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ accounts: await listInstagramAccounts() });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
