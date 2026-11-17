import "server-only";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { track } from "@/lib/analytics/server";
import { db, schema } from "@/lib/db";

import { alertCancelScheduled, alertEnded, alertFirstPayment, alertPaymentFailed, alertSubscribed } from "./alerts";
import { isActiveSubscriptionStatus } from "./status";
import { stripeCall, USER_METADATA_KEY } from "./stripe";

/**
 * Keeps `billing_customers` in step with Stripe. The design and its rules
 * (always re-read, one subscription per user, release the claim on failure)
 * are Adeli's, see docs/billing.md.
 *
 * The Stripe account is shared with Adeli, so this sees Adeli's events too.
 * A customer that isn't a LedaChat user's is ignored without a warning.
 */

export type StripeEventOutcome = { userId: string | null };

const NOTHING: StripeEventOutcome = { userId: null };

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/** Claims a delivery; false when it was already handled. */
export async function claimStripeEvent(eventId: string): Promise<boolean> {
  const [claimed] = await db().insert(schema.processedStripeEvents).values({ eventId }).onConflictDoNothing().returning({ eventId: schema.processedStripeEvents.eventId });
  return Boolean(claimed);
}

/** Frees a claim after a failure, so Stripe's retry is handled. */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await db().delete(schema.processedStripeEvents).where(eq(schema.processedStripeEvents.eventId, eventId));
}

/**
 * The LedaChat user a Stripe customer bills: from our row, or from the
 * customer's `ledachat_user_id` metadata (checked against `auth_user`) for a
 * customer whose row is missing. Null for anyone else's customer (Adeli's).
 */
async function resolveUserId(stripe: Stripe, customerId: string): Promise<string | null> {
  const [row] = await db().select({ userId: schema.billingCustomers.userId }).from(schema.billingCustomers).where(eq(schema.billingCustomers.stripeCustomerId, customerId)).limit(1);
  if (row) return row.userId;
  const customer = await stripeCall("customers.retrieve", () => stripe.customers.retrieve(customerId));
  const userId = customer.deleted ? null : customer.metadata?.[USER_METADATA_KEY] ?? null;
  if (!userId) return null;
  const [known] = await db().select({ id: schema.authUser.id }).from(schema.authUser).where(eq(schema.authUser.id, userId)).limit(1);
  if (!known) return null;
  await db().insert(schema.billingCustomers).values({ userId, stripeCustomerId: customerId }).onConflictDoNothing();
  return userId;
}

/**
 * Mirrors one subscription into `billing_customers`, always re-read from
 * Stripe: Stripe doesn't guarantee event order, and an older snapshot must
 * never overwrite a newer one. Alerts and analytics fire on transitions only.
 */
export async function syncSubscription(stripe: Stripe, subscriptionId: string): Promise<StripeEventOutcome> {
  const subscription = await stripeCall("subscriptions.retrieve", () => stripe.subscriptions.retrieve(subscriptionId));
  const customerId = idOf(subscription.customer);
  if (!customerId) return NOTHING;
  const userId = await resolveUserId(stripe, customerId);
  if (!userId) return NOTHING;

  const [previous] = await db().select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, userId)).limit(1);
  const active = isActiveSubscriptionStatus(subscription.status);
  const recordedOther = previous?.stripeSubscriptionId && previous.stripeSubscriptionId !== subscription.id && isActiveSubscriptionStatus(previous.subscriptionStatus);
  // A user has one subscription. An event for an older one never replaces a newer, active one.
  if (recordedOther && !active) return { userId };
  // A second active subscription is a duplicate (two checkouts finished before
  // the first webhook landed), which would charge $25 twice. Keep the recorded
  // one if Stripe confirms it's still active, and cancel the newcomer unbilled.
  if (recordedOther && active) {
    const recordedId = previous.stripeSubscriptionId!;
    const recorded = await stripeCall("subscriptions.retrieve", () => stripe.subscriptions.retrieve(recordedId)).catch((error: unknown) => {
      if ((error as { code?: string }).code === "resource_missing") return null;
      throw error;
    });
    if (recorded && isActiveSubscriptionStatus(recorded.status)) {
      await stripeCall("subscriptions.cancel", () => stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false }));
      console.warn(`Cancelled a duplicate LedaChat subscription for ${userId}, kept ${recordedId}`);
      return { userId };
    }
  }

  // In this API version the period lives on the items. A portal cancellation
  // sets `cancel_at_period_end` or `cancel_at`, depending on its settings.
  const item = subscription.items.data[0];
  const cancelAt = toDate(subscription.cancel_at);
  const cancelling = active && (subscription.cancel_at_period_end || cancelAt !== null);
  const periodEnd = cancelAt ?? toDate(item?.current_period_end);
  await db().update(schema.billingCustomers).set({
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: cancelling,
    currentPeriodEnd: periodEnd,
    updatedAt: new Date(),
  }).where(eq(schema.billingCustomers.userId, userId));

  const same = previous?.stripeSubscriptionId === subscription.id;
  const wasActive = same && isActiveSubscriptionStatus(previous.subscriptionStatus);
  if (active && !wasActive) {
    track(userId, "subscription_started", { status: subscription.status });
    await alertSubscribed(userId, customerId);
  } else if (!active && wasActive) {
    track(userId, "subscription_ended", { status: subscription.status });
    await alertEnded(userId, customerId, subscription.status);
  } else if (cancelling && same && !previous.cancelAtPeriodEnd) {
    track(userId, "subscription_cancel_scheduled");
    await alertCancelScheduled(userId, customerId, periodEnd);
  }
  return { userId };
}

const RECONCILE_INTERVAL_MS = 60_000;
/** How long past its period end an "active" subscription may go unrenewed before we ask Stripe. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const lastReconciled = new Map<string, number>();

/**
 * Repairs what a missed webhook would leave wrong, in both directions, at
 * most once a minute per user:
 * - a paying user recorded as Free (no active subscription on record): find
 *   an active subscription in Stripe and mirror it;
 * - a user recorded as Pro whose period ended more than a day ago (the
 *   renewal, failed payment or end was never mirrored): re-read that
 *   subscription, which renews the period, or ends Pro.
 */
export async function reconcileSubscription(stripe: Stripe, userId: string, now = Date.now()): Promise<boolean> {
  const [row] = await db().select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, userId)).limit(1);
  if (!row) return false;
  const stale = isActiveSubscriptionStatus(row.subscriptionStatus) && row.stripeSubscriptionId !== null && row.currentPeriodEnd !== null && row.currentPeriodEnd.getTime() + STALE_AFTER_MS < now;
  if (isActiveSubscriptionStatus(row.subscriptionStatus) && !stale) return false;
  const last = lastReconciled.get(userId);
  if (last !== undefined && now - last < RECONCILE_INTERVAL_MS) return false;
  lastReconciled.set(userId, now);
  if (stale) {
    console.error(`Stripe subscription ${row.stripeSubscriptionId} is past its period end with no webhook since; re-read it from Stripe. Check the webhook endpoint.`);
    await syncSubscription(stripe, row.stripeSubscriptionId!);
    return true;
  }
  const subscriptions = await stripeCall("subscriptions.list", () => stripe.subscriptions.list({ customer: row.stripeCustomerId, status: "all", limit: 10 }));
  const live = subscriptions.data.find((subscription) => isActiveSubscriptionStatus(subscription.status));
  if (!live) return false;
  console.error(`Stripe subscription ${live.id} was never mirrored by a webhook; synced it from Stripe. Check the webhook endpoint.`);
  await syncSubscription(stripe, live.id);
  return true;
}

/** Forget reconcile throttling, for tests. */
export function resetReconcileThrottle() {
  lastReconciled.clear();
}

async function syncTaxLocation(stripe: Stripe, customerId: string) {
  const [row] = await db().select({ userId: schema.billingCustomers.userId }).from(schema.billingCustomers).where(eq(schema.billingCustomers.stripeCustomerId, customerId)).limit(1);
  if (!row) return NOTHING;
  const customer = await stripeCall("customers.retrieve", () => stripe.customers.retrieve(customerId, { expand: ["tax"] }));
  if (customer.deleted) return NOTHING;
  const invalid = customer.tax?.automatic_tax === "unrecognized_location";
  await db().update(schema.billingCustomers).set({ taxLocationInvalid: invalid, updatedAt: new Date() }).where(eq(schema.billingCustomers.stripeCustomerId, customerId));
  return { userId: row.userId };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

/** Applies one verified event. Throws on failure, so the route releases the claim and Stripe retries. */
export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<StripeEventOutcome> {
  switch (event.type) {
    case "checkout.session.completed": {
      const subscriptionId = idOf(event.data.object.subscription);
      return subscriptionId ? syncSubscription(stripe, subscriptionId) : NOTHING;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(stripe, event.data.object.id);
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return NOTHING;
      const outcome = await syncSubscription(stripe, subscriptionId);
      const customerId = idOf(invoice.customer);
      if (outcome.userId && customerId) {
        if (event.type === "invoice.paid" && invoice.amount_paid > 0) await alertFirstPayment(outcome.userId, customerId, invoice.amount_paid);
        if (event.type === "invoice.payment_failed") await alertPaymentFailed(outcome.userId, customerId, invoice.amount_due);
      }
      return outcome;
    }
    case "invoice.finalization_failed": {
      const invoice = event.data.object;
      const customerId = idOf(invoice.customer);
      if (!customerId || invoice.automatic_tax?.status !== "requires_location_inputs") return NOTHING;
      const [row] = await db().update(schema.billingCustomers).set({ taxLocationInvalid: true, updatedAt: new Date() }).where(eq(schema.billingCustomers.stripeCustomerId, customerId)).returning({ userId: schema.billingCustomers.userId });
      return { userId: row?.userId ?? null };
    }
    case "customer.updated":
      return syncTaxLocation(stripe, event.data.object.id);
    default:
      return NOTHING;
  }
}
