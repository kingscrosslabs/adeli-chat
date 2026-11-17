import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";
import { PLANS, type PlanId } from "@adeli-chat/ui/billing/plans";

import { billingEnabled } from "./config";
import { isActiveSubscriptionStatus } from "./status";

/** `unlimited` is an install without Stripe keys (local, self-hosted): no limits, no branding. */
export type Plan = PlanId | "unlimited";

export type BillingCustomer = typeof schema.billingCustomers.$inferSelect;

export async function getBillingCustomer(userId: string): Promise<BillingCustomer | null> {
  const [row] = await db().select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, userId)).limit(1);
  return row ?? null;
}

/**
 * Pro while the subscription is active, except that a cancelled one (Stripe's
 * `cancel_at` or `cancel_at_period_end`) stops counting at its end date even
 * if the webhook that ends it never arrives.
 */
export function planOf(customer: Pick<BillingCustomer, "subscriptionStatus" | "cancelAtPeriodEnd" | "currentPeriodEnd"> | null, now = new Date()): PlanId {
  if (!customer || !isActiveSubscriptionStatus(customer.subscriptionStatus)) return "free";
  if (customer.cancelAtPeriodEnd && customer.currentPeriodEnd && customer.currentPeriodEnd <= now) return "free";
  return "pro";
}

/**
 * Pro: an active Stripe subscription, or `user_settings.plan = 'pro'` set by
 * hand (a comped user). Read from LedaChat's own tables; never calls Stripe.
 */
export async function isPro(userId: string): Promise<boolean> {
  const [customer, settings] = await Promise.all([getBillingCustomer(userId), getUserSettings(userId)]);
  return planOf(customer) === "pro" || settings.plan === "pro";
}

/** The user's plan for limits: `unlimited` when the install has no billing. */
export async function getPlan(userId: string): Promise<Plan> {
  if (!billingEnabled()) return "unlimited";
  return (await isPro(userId)) ? "pro" : "free";
}

/** How many automations may be live at once, or null for no limit. */
export function liveAutomationLimit(plan: Plan): number | null {
  return plan === "unlimited" ? null : PLANS[plan].liveAutomations;
}
