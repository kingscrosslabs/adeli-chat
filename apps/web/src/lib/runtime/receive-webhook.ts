import "server-only";

import { MalformedResponseError } from "@adeli/sdk";
import { parseWebhookEvent, verifyWebhookSignature } from "@adeli/sdk/helpers";
import { after } from "next/server";

import { trackError } from "@/lib/analytics/server";
import { handleEvent } from "@/lib/runtime/handle";

/**
 * Verifies an Adeli delivery against the candidate users' signing secrets,
 * answers at once, and handles the event after the response for the user
 * whose secret matched, so Adeli never waits on Instagram.
 */
export async function receiveWebhook(request: Request, candidates: Array<{ userId: string; secret: string }>) {
  const body = await request.text();
  if (!candidates.length) return Response.json({ error: { code: "not_configured", message: "No Adeli webhook is registered for this URL." } }, { status: 404 });
  const header = request.headers.get("adeli-signature");
  const owner = candidates.find((candidate) => verifyWebhookSignature({ payload: body, header, secret: candidate.secret }));
  if (!owner) return Response.json({ error: { code: "invalid_signature", message: "The Adeli-Signature header doesn't match." } }, { status: 401 });

  let event;
  try {
    event = parseWebhookEvent(body);
  } catch (error) {
    if (error instanceof MalformedResponseError) return Response.json({ error: { code: "invalid_event", message: error.message } }, { status: 400 });
    throw error;
  }

  after(async () => {
    try {
      await handleEvent(owner.userId, event);
    } catch (error) {
      console.error(`Adeli webhook ${event.id} (${event.type}) failed: ${error instanceof Error ? error.message : String(error)}`);
      trackError(error, owner.userId, { adeli_event_type: event.type });
    }
  });
  return Response.json({ received: true });
}
