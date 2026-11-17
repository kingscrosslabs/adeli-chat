// One-time Stripe setup for LedaChat Pro, once per Stripe account and mode.
// The account is shared with Adeli, so everything here is tagged
// `metadata.ledachat_key` and never touches Adeli's objects.
//
//   node apps/web/scripts/stripe-bootstrap.mjs            # report, change nothing
//   STRIPE_SECRET_KEY=sk_test_... node apps/web/scripts/stripe-bootstrap.mjs --apply
//
// It needs write access to products, prices and portal settings, which the
// app's restricted key deliberately lacks: pass a broader key for this one
// command, and never put that key in Vercel. It reads STRIPE_SECRET_KEY from
// the environment first, then apps/web/.env.local. It never touches customers
// or subscriptions. See docs/billing.md.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Stripe from "stripe";

const apply = process.argv.includes("--apply");
const PRODUCT_KEY = "ledachat_pro";
const LOOKUP_KEY = "ledachat_pro_monthly";
const PORTAL_KEY = "ledachat_billing_portal";
// Must match PLANS.pro.priceCents in packages/ui/src/billing/plans.ts.
const PRICE_CENTS = 2500;
const TAX_CODE = "txcd_10103001";

function secretKey() {
  if (process.env.STRIPE_SECRET_KEY?.trim()) return process.env.STRIPE_SECRET_KEY.trim();
  const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  try {
    const line = readFileSync(envFile, "utf8").split("\n").find((text) => text.startsWith("STRIPE_SECRET_KEY="));
    return line?.slice("STRIPE_SECRET_KEY=".length).trim().replace(/^["']|["']$/g, "") || null;
  } catch {
    return null;
  }
}

const key = secretKey();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (in the environment or apps/web/.env.local).");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2026-10-28.endive" });
const say = (text) => console.info(text);
say(`${apply ? "Applying" : "Checking (dry run)"} in ${key.includes("_test_") ? "test mode / sandbox" : "LIVE mode"}\n`);

async function product() {
  const { data: [found] } = await stripe.products.search({ query: `metadata['ledachat_key']:'${PRODUCT_KEY}'`, limit: 1 });
  if (found) return say(`product: ok (${found.id})`), found;
  if (!apply) return say("product: MISSING"), null;
  const created = await stripe.products.create({
    name: "Leda Chat Pro",
    description: "Unlimited live automations and no LedaChat branding in the last DM.",
    tax_code: TAX_CODE,
    statement_descriptor: "LEDACHAT PRO",
    metadata: { ledachat_key: PRODUCT_KEY },
  });
  say(`product: created (${created.id})`);
  return created;
}

async function price(productId) {
  const { data: [found] } = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1 });
  if (found) {
    const same = found.unit_amount === PRICE_CENTS && found.currency === "usd" && found.recurring?.interval === "month";
    say(same ? `price: ok (${found.id})` : `price: PRICE DIFFERS (${found.id} is ${found.unit_amount} ${found.currency}/${found.recurring?.interval}; expected ${PRICE_CENTS} usd/month). Create a new price and move the lookup key to it.`);
    return found;
  }
  if (!apply || !productId) return say("price: MISSING"), null;
  const created = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: PRICE_CENTS,
    recurring: { interval: "month" },
    tax_behavior: "exclusive",
    lookup_key: LOOKUP_KEY,
    nickname: "LedaChat Pro monthly",
    metadata: { ledachat_key: LOOKUP_KEY },
  });
  say(`price: created (${created.id})`);
  return created;
}

async function portal() {
  let found = null;
  for await (const configuration of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (configuration.metadata?.ledachat_key === PORTAL_KEY) {
      found = configuration;
      break;
    }
  }
  const settings = {
    business_profile: { headline: "LedaChat billing" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      // A flat price, so cancelling is safe (unlike Adeli's metered billing): Pro lasts to the period end.
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] } },
      subscription_update: { enabled: false },
    },
    metadata: { ledachat_key: PORTAL_KEY },
  };
  if (!apply) return say(`customer portal: ${found ? `config ${found.id} would be updated` : "MISSING"}`);
  // Every --apply overwrites it, so change these settings here, not in the Dashboard.
  const saved = found ? await stripe.billingPortal.configurations.update(found.id, settings) : await stripe.billingPortal.configurations.create(settings);
  say(`customer portal: config ${found ? "updated" : "created"} (${saved.id})`);
}

async function tax() {
  try {
    const settings = await stripe.tax.settings.retrieve();
    const registrations = await stripe.tax.registrations.list({ status: "active", limit: 100 });
    say(`tax: settings ${settings.status}, ${registrations.data.length} active registration${registrations.data.length === 1 ? "" : "s"}${registrations.data.length ? ` (${registrations.data.map((registration) => registration.country).join(", ")})` : ". Stripe collects $0 tax until one is added (Tax > Registrations)"}`);
  } catch (error) {
    say(`tax: couldn't read (${error.message})`);
  }
}

const created = await product();
await price(created?.id ?? null);
await portal();
await tax();
if (!apply) say("\nNothing was changed. Run with --apply to create what's missing.");
