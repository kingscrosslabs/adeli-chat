import "server-only";

import Stripe from "stripe";

import { getStripeConfig, type StripeConfig } from "./config";

/**
 * The Stripe API version this code is written against, pinned so a change to
 * the account's default in the Dashboard can't change response shapes. In
 * this version a subscription's billing period lives on its items.
 */
export const STRIPE_API_VERSION = "2026-10-28.endive";

/** Lookup keys of the prices `scripts/stripe-bootstrap.mjs` creates. Code never uses price ids. */
export const STRIPE_LOOKUP_KEYS = { proMonthly: "ledachat_pro_monthly" } as const;

/** The tag on LedaChat's Customer Portal configuration (the Stripe account is shared with Adeli). */
export const PORTAL_CONFIGURATION_KEY = "ledachat_billing_portal";

/** The metadata key that marks a Stripe customer as a LedaChat user's. */
export const USER_METADATA_KEY = "ledachat_user_id";

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Stripe billing is not configured");
    this.name = "BillingNotConfiguredError";
  }
}

let cached: { key: string; client: Stripe } | null = null;

/**
 * The Stripe client, built on first use. It sends through the global `fetch`
 * at call time, so tests drive it with the same fake `fetch` as Adeli.
 */
export function getStripe(config: StripeConfig | null = getStripeConfig()): Stripe {
  if (!config) throw new BillingNotConfiguredError();
  if (cached?.key === config.secretKey) return cached.client;
  const client = new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "ledachat" },
    httpClient: Stripe.createFetchHttpClient((input, init) => fetch(input, init)),
  });
  cached = { key: config.secretKey, client };
  return client;
}

/** Runs one Stripe request, logging a failure by operation name (never an id). */
export async function stripeCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Stripe ${operation} failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

const priceCache = new Map<string, string>();

/** A price id by lookup key, once per process. */
export async function resolvePriceId(lookupKey: string): Promise<string> {
  const known = priceCache.get(lookupKey);
  if (known) return known;
  const prices = await stripeCall("prices.list", () => getStripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 }));
  const price = prices.data[0];
  if (!price) throw new Error(`No active Stripe price has lookup key ${lookupKey}; run apps/web/scripts/stripe-bootstrap.mjs --apply`);
  priceCache.set(lookupKey, price.id);
  return price.id;
}

let portalConfigurationId: string | null = null;

/**
 * LedaChat's Customer Portal configuration, found by its metadata tag. The
 * account's default belongs to Adeli, so every portal session names this one.
 */
export async function resolvePortalConfigurationId(): Promise<string> {
  if (portalConfigurationId) return portalConfigurationId;
  for await (const configuration of getStripe().billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (configuration.metadata?.ledachat_key === PORTAL_CONFIGURATION_KEY) {
      portalConfigurationId = configuration.id;
      return configuration.id;
    }
  }
  throw new Error("No Customer Portal configuration is tagged for LedaChat; run apps/web/scripts/stripe-bootstrap.mjs --apply");
}

/** Forget cached ids and the client, for tests. */
export function resetStripeCaches() {
  cached = null;
  priceCache.clear();
  portalConfigurationId = null;
}

/** The Stripe Dashboard page for a customer, in test or live mode. */
export function stripeCustomerUrl(customerId: string): string {
  const test = process.env.STRIPE_SECRET_KEY?.includes("_test_");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}customers/${customerId}`;
}
