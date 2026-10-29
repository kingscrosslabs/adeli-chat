import { MalformedResponseError } from "@adeli/sdk";
import { parseWebhookEvent, verifyWebhookSignature } from "@adeli/sdk/helpers";
import { after } from "next/server";

import { getAppSettings } from "@/lib/app-settings";
import { handleEvent } from "@/lib/runtime/handle";

export const dynamic = "force-dynamic";

/**
 * Adeli's webhook. Verifies the signature on the raw body, answers at once,
 * and handles the event after the response so Adeli never waits on Instagram.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const { adeliWebhookSecret: secret } = await getAppSettings();
  if (!secret) return Response.json({ error: { code: "not_configured", message: "This install hasn't registered its Adeli webhook yet." } }, { status: 503 });
  if (!verifyWebhookSignature({ payload: body, header: request.headers.get("adeli-signature"), secret })) {
    return Response.json({ error: { code: "invalid_signature", message: "The Adeli-Signature header doesn't match." } }, { status: 401 });
  }

  let event;
  try {
    event = parseWebhookEvent(body);
  } catch (error) {
    if (error instanceof MalformedResponseError) return Response.json({ error: { code: "invalid_event", message: error.message } }, { status: 400 });
    throw error;
  }

  after(async () => {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error(`Adeli webhook ${event.id} (${event.type}) failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return Response.json({ received: true });
}
