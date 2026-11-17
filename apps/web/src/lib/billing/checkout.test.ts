import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, schema } from "@/lib/db";

import { resetDatabase, seedUser } from "../../../test/db-helpers";
import { fakeStripe } from "../../../test/fake-stripe";

import { startCheckout } from "./checkout";
import { getStripeConfig } from "./config";

const USER = "user_1";
const party = { userId: USER, email: "user_1@example.com", name: "Nick" };

beforeEach(async () => {
  await resetDatabase();
  await seedUser(USER);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("startCheckout", () => {
  it("creates a customer tagged with the user, then a Pro checkout", async () => {
    const stripe = fakeStripe();
    const opened = await startCheckout(party);
    expect(opened).toEqual({ kind: "checkout", url: "https://checkout.stripe.com/c/pay/cs_new" });
    const [customer] = stripe.calls("POST", "/customers");
    expect(customer.params.get("metadata[ledachat_user_id]")).toBe(USER);
    const [session] = stripe.calls("POST", "/checkout/sessions");
    expect(session.params.get("mode")).toBe("subscription");
    expect(session.params.get("line_items[0][price]")).toBe("price_pro");
    expect(session.params.get("line_items[0][quantity]")).toBe("1");
    expect(session.params.get("client_reference_id")).toBe(USER);
    expect(session.params.get("automatic_tax[enabled]")).toBe("true");
    expect(session.params.get("allow_promotion_codes")).toBe("true");
    expect(session.params.get("success_url")).toBe("http://localhost:3030/settings?checkout=success#plan");
    const [row] = await db().select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, USER));
    expect(row.stripeCustomerId).toBe("cus_1");
  });

  it("expires the user's open checkouts first, so an old tab can't make a second subscription", async () => {
    const stripe = fakeStripe();
    await db().insert(schema.billingCustomers).values({ userId: USER, stripeCustomerId: "cus_1" });
    stripe.addOpenSession("cs_old", "cus_1");
    await startCheckout(party);
    expect(stripe.calls("POST", "/checkout/sessions/cs_old/expire")).toHaveLength(1);
  });

  it("sends a subscriber to the portal, even when only Stripe knows they subscribe", async () => {
    const stripe = fakeStripe();
    await db().insert(schema.billingCustomers).values({ userId: USER, stripeCustomerId: "cus_1" });
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    const opened = await startCheckout(party);
    expect(opened).toEqual({ kind: "portal", url: "https://billing.stripe.com/p/session_1" });
    expect(stripe.calls("POST", "/checkout/sessions")).toHaveLength(0);
    const [portal] = stripe.calls("POST", "/billing_portal/sessions");
    expect(portal.params.get("configuration")).toBe("bpc_ledachat");
  });
});

describe("getStripeConfig", () => {
  it("is off unless both keys are set", () => {
    expect(getStripeConfig()).toBeNull();
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_test_1");
    expect(getStripeConfig()).toBeNull();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_1");
    expect(getStripeConfig()).toEqual({ secretKey: "rk_test_1", webhookSecret: "whsec_1" });
  });

  it("rejects a publishable key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "pk_test_1");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_1");
    expect(() => getStripeConfig()).toThrow(/publishable/);
  });
});
