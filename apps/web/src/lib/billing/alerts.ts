import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { describeUser } from "@/lib/alerts/people";
import { db, schema } from "@/lib/db";
import { notifySlack, postSlack } from "@/lib/slack";

import { stripeCustomerUrl } from "./stripe";

/**
 * Billing news for the team's Slack (`SLACK_BILLING_ALERT_WEBHOOK_URL`, the
 * same webhook as Adeli's billing alerts). Every title says LedaChat, since
 * the channel carries both products. Never fails the Stripe webhook.
 */

function link(customerId: string) {
  return `<${stripeCustomerUrl(customerId)}|Stripe customer>`;
}

async function send(lines: Array<string | null>) {
  void notifySlack("billing", lines.filter(Boolean).join("\n"));
}

export async function alertSubscribed(userId: string, customerId: string) {
  await send([`:tada: *New LedaChat Pro subscription: ${await describeUser(userId)}*`, link(customerId)]);
}

export async function alertCancelScheduled(userId: string, customerId: string, endsAt: Date | null) {
  await send([`:wave: *LedaChat Pro cancelled by ${await describeUser(userId)}*`, endsAt ? `Pro until ${endsAt.toISOString().slice(0, 10)}` : null, link(customerId)]);
}

export async function alertEnded(userId: string, customerId: string, status: string) {
  await send([`:door: *LedaChat Pro ended for ${await describeUser(userId)}* (${status})`, link(customerId)]);
}

export async function alertPaymentFailed(userId: string, customerId: string, amountCents: number) {
  await send([`:warning: *LedaChat payment failed: $${(amountCents / 100).toFixed(2)}* from ${await describeUser(userId)}`, "Stripe will retry the card.", link(customerId)]);
}

/**
 * The first payment that took money, once per user. Recorded only after
 * Slack accepts it, so a Slack failure is tried again on the next paid invoice.
 */
export async function alertFirstPayment(userId: string, customerId: string, amountCents: number) {
  const [row] = await db().select({ alertedAt: schema.billingCustomers.firstPaymentAlertedAt }).from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, userId)).limit(1);
  if (!row || row.alertedAt) return;
  try {
    const sent = await postSlack("billing", [`:moneybag: *LedaChat first payment: $${(amountCents / 100).toFixed(2)}* from ${await describeUser(userId)}`, link(customerId)].join("\n"));
    if (sent) await db().update(schema.billingCustomers).set({ firstPaymentAlertedAt: new Date() }).where(and(eq(schema.billingCustomers.userId, userId), isNull(schema.billingCustomers.firstPaymentAlertedAt)));
  } catch (error) {
    console.warn(`Couldn't post the first-payment alert: ${error instanceof Error ? error.message : String(error)}`);
  }
}
