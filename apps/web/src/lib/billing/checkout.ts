import "server-only";

import { createHash } from "node:crypto";

import { appUrl } from "@/lib/app-url";
import { db, schema } from "@/lib/db";

import { getBillingCustomer, type BillingCustomer } from "./state";
import { isActiveSubscriptionStatus } from "./status";
import { getStripe, resolvePortalConfigurationId, resolvePriceId, stripeCall, STRIPE_LOOKUP_KEYS, USER_METADATA_KEY } from "./stripe";

/** Who pays: the signed-in user, never anyone named by the browser. */
export type BillingParty = { userId: string; email: string; name?: string | null };

const PLAN_URL = "/settings#plan";

/** The user's Stripe customer, created on first use and recorded before checkout starts. */
export async function ensureStripeCustomer(party: BillingParty): Promise<BillingCustomer> {
  const existing = await getBillingCustomer(party.userId);
  if (existing) return existing;
  const params = { email: party.email, name: party.name || undefined, metadata: { [USER_METADATA_KEY]: party.userId } };
  // Idempotent, so two clicks can't create two customers. Stripe rejects a
  // key reused with other parameters, so the key covers them.
  const fingerprint = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 16);
  const customer = await stripeCall("customers.create", () => getStripe().customers.create(params, { idempotencyKey: `ledachat-customer-${party.userId}-${fingerprint}` }));
  await db().insert(schema.billingCustomers).values({ userId: party.userId, stripeCustomerId: customer.id }).onConflictDoNothing();
  const row = await getBillingCustomer(party.userId);
  if (!row) throw new Error("Couldn't record the Stripe customer");
  return row;
}

/**
 * Where "Upgrade" goes: Stripe Checkout for a new subscription, or the
 * Customer Portal when the user already pays. A user has one subscription,
 * so this asks Stripe too (the webhook can lag the checkout that created
 * one), and expires their open checkouts so an old tab can't make a second.
 */
export async function startCheckout(party: BillingParty): Promise<{ kind: "checkout" | "portal"; url: string }> {
  const customer = await ensureStripeCustomer(party);
  if (customer.stripeSubscriptionId && isActiveSubscriptionStatus(customer.subscriptionStatus)) {
    return { kind: "portal", url: await openPortal(customer.stripeCustomerId) };
  }
  const stripe = getStripe();
  const subscriptions = await stripeCall("subscriptions.list", () => stripe.subscriptions.list({ customer: customer.stripeCustomerId, status: "all", limit: 20 }));
  // `incomplete` counts: its checkout is still collecting the first payment.
  if (subscriptions.data.some((subscription) => isActiveSubscriptionStatus(subscription.status) || subscription.status === "incomplete")) {
    return { kind: "portal", url: await openPortal(customer.stripeCustomerId) };
  }
  const open = await stripeCall("checkout.sessions.list", () => stripe.checkout.sessions.list({ customer: customer.stripeCustomerId, status: "open", limit: 100 }));
  for (const session of open.data) {
    if (session.mode === "subscription") await stripeCall("checkout.sessions.expire", () => stripe.checkout.sessions.expire(session.id));
  }
  const price = await resolvePriceId(STRIPE_LOOKUP_KEYS.proMonthly);
  const session = await stripeCall("checkout.sessions.create", () => stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.stripeCustomerId,
    client_reference_id: party.userId,
    line_items: [{ price, quantity: 1 }],
    // Promotion codes, such as the tester code (100% off, limited to Leda Chat Pro).
    allow_promotion_codes: true,
    subscription_data: { metadata: { [USER_METADATA_KEY]: party.userId } },
    automatic_tax: { enabled: true },
    // A full address: some US city and county rates need more than a postcode.
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    tax_id_collection: { enabled: true },
    success_url: `${appUrl()}/settings?checkout=success#plan`,
    cancel_url: `${appUrl()}${PLAN_URL}`,
  }));
  if (!session.url) throw new Error("Stripe didn't return a Checkout URL");
  return { kind: "checkout", url: session.url };
}

/** A Customer Portal session on LedaChat's configuration: card, address, invoices, cancelling. */
export async function openPortal(stripeCustomerId: string): Promise<string> {
  const configuration = await resolvePortalConfigurationId();
  const session = await stripeCall("billingPortal.sessions.create", () => getStripe().billingPortal.sessions.create({ customer: stripeCustomerId, configuration, return_url: `${appUrl()}${PLAN_URL}` }));
  return session.url;
}
