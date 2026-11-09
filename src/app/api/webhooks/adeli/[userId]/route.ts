import { receiveWebhook } from "@/lib/runtime/receive-webhook";
import { webhookSecrets } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

/** One user's Adeli webhook. Verified with that user's secret and handled only for their accounts. */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return receiveWebhook(request, await webhookSecrets(userId));
}
