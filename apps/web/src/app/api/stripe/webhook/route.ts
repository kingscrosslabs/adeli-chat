import type Stripe from "stripe";

import { getStripeConfig } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { claimStripeEvent, handleStripeEvent, releaseStripeEvent } from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe's subscription, invoice and customer events, which keep
 * `billing_customers` in step with Stripe. Unlike Adeli's webhooks, a handling
 * failure returns 500 on purpose: Stripe retries for days, which is what a
 * failed database write needs. The claim is released first so the retry
 * isn't skipped as a duplicate. See docs/billing.md.
 */
export async function POST(request: Request) {
  const config = getStripeConfig();
  if (!config) return Response.json({ error: { message: "Stripe billing is not configured" } }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: { message: "Missing Stripe signature" } }, { status: 400 });
  const rawBody = await request.text();
  const stripe = getStripe(config);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, config.webhookSecret);
  } catch {
    return Response.json({ error: { message: "Invalid webhook signature" } }, { status: 400 });
  }

  if (!(await claimStripeEvent(event.id))) return Response.json({ received: true, duplicate: true });
  try {
    await handleStripeEvent(stripe, event);
  } catch (error) {
    console.error(`Stripe webhook ${event.type} failed: ${error instanceof Error ? error.message : String(error)}`);
    await releaseStripeEvent(event.id).catch(() => undefined);
    return Response.json({ error: { message: "Couldn't handle the event" } }, { status: 500 });
  }
  return Response.json({ received: true });
}
