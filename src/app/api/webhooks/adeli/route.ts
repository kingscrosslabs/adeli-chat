import { receiveWebhook } from "@/lib/runtime/receive-webhook";
import { webhookSecrets } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

/**
 * The webhook URL from before each user had their own
 * (`/api/webhooks/adeli/[userId]`). A delivery here is matched to the user
 * whose secret signed it. Testing or saving the key in Settings moves a user
 * to the new URL, after which nothing calls this.
 */
export async function POST(request: Request) {
  return receiveWebhook(request, await webhookSecrets());
}
