import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/stripe/webhook/route";
import { db, schema } from "@/lib/db";

import { resetDatabase, seedUser } from "../../../test/db-helpers";
import { fakeStripe, signedWebhook } from "../../../test/fake-stripe";

import { getPlan } from "./state";
import { getStripe } from "./stripe";
import { reconcileSubscription } from "./webhook";

const USER = "user_1";
const SLACK = "https://hooks.slack.com/services/billing";

async function row() {
  const [found] = await db().select().from(schema.billingCustomers).where(eq(schema.billingCustomers.userId, USER));
  return found;
}

let eventCount = 0;
function subscriptionEvent(type: string, id = "sub_1") {
  eventCount += 1;
  return signedWebhook({ id: `evt_${eventCount}`, type, data: { object: { object: "subscription", id } } });
}

beforeEach(async () => {
  await resetDatabase();
  await seedUser(USER);
  await db().insert(schema.billingCustomers).values({ userId: USER, stripeCustomerId: "cus_1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/stripe/webhook", () => {
  it("refuses a bad signature", async () => {
    fakeStripe();
    const response = await POST(signedWebhook({ id: "evt_bad", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } }, "whsec_wrong"));
    expect(response.status).toBe(400);
  });

  it("is off without Stripe keys", async () => {
    const response = await POST(subscriptionEvent("customer.subscription.updated"));
    expect(response.status).toBe(503);
  });

  it("mirrors a new subscription, makes the user Pro and alerts Slack once", async () => {
    const stripe = fakeStripe();
    vi.stubEnv("SLACK_BILLING_ALERT_WEBHOOK_URL", SLACK);
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    expect((await POST(subscriptionEvent("customer.subscription.created"))).status).toBe(200);
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_1", subscriptionStatus: "active", cancelAtPeriodEnd: false });
    expect(await getPlan(USER)).toBe("pro");
    await POST(subscriptionEvent("customer.subscription.updated"));
    await vi.waitFor(() => expect(stripe.slack).toHaveLength(1));
    expect(stripe.slack[0].text).toContain("New LedaChat Pro subscription: user_1");
  });

  it("skips a redelivered event", async () => {
    const stripe = fakeStripe();
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    const event = { id: "evt_same", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } };
    await POST(signedWebhook(event));
    const body = await (await POST(signedWebhook(event))).json();
    expect(body).toEqual({ received: true, duplicate: true });
    expect(stripe.calls("GET", "/subscriptions/sub_1")).toHaveLength(1);
  });

  it("releases the claim and answers 500 when handling fails, so Stripe's retry runs", async () => {
    const stripe = fakeStripe();
    const event = { id: "evt_retry", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } };
    expect((await POST(signedWebhook(event))).status).toBe(500);
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    expect((await POST(signedWebhook(event))).status).toBe(200);
    expect(await getPlan(USER)).toBe("pro");
  });

  it("records a scheduled cancellation, then Free when it ends", async () => {
    const stripe = fakeStripe();
    vi.stubEnv("SLACK_BILLING_ALERT_WEBHOOK_URL", SLACK);
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    await POST(subscriptionEvent("customer.subscription.created"));
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: true, current_period_end: 1_800_000_000 });
    await POST(subscriptionEvent("customer.subscription.updated"));
    expect(await row()).toMatchObject({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date(1_800_000_000 * 1000) });
    expect(await getPlan(USER)).toBe("pro");
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "canceled" });
    await POST(subscriptionEvent("customer.subscription.deleted"));
    expect(await getPlan(USER)).toBe("free");
    await vi.waitFor(() => expect(stripe.slack.map((message) => message.text.split("\n")[0])).toEqual([
      expect.stringContaining("New LedaChat Pro subscription"),
      expect.stringContaining("LedaChat Pro cancelled by"),
      expect.stringContaining("LedaChat Pro ended for"),
    ]));
  });

  it("keeps Pro while past due", async () => {
    const stripe = fakeStripe();
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "past_due" });
    await POST(subscriptionEvent("customer.subscription.updated"));
    expect(await getPlan(USER)).toBe("pro");
  });

  it("never lets an older subscription's event replace a newer active one", async () => {
    const stripe = fakeStripe();
    stripe.setSubscription({ id: "sub_new", customer: "cus_1", status: "active" });
    await POST(subscriptionEvent("customer.subscription.created", "sub_new"));
    stripe.setSubscription({ id: "sub_old", customer: "cus_1", status: "canceled" });
    await POST(subscriptionEvent("customer.subscription.deleted", "sub_old"));
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_new", subscriptionStatus: "active" });
  });

  it("cancels a duplicate active subscription without invoicing it", async () => {
    const stripe = fakeStripe();
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    await POST(subscriptionEvent("customer.subscription.created", "sub_1"));
    stripe.setSubscription({ id: "sub_2", customer: "cus_1", status: "active" });
    await POST(subscriptionEvent("customer.subscription.created", "sub_2"));
    const [cancel] = stripe.calls("DELETE", "/subscriptions/sub_2");
    expect(cancel.params.get("invoice_now")).toBe("false");
    expect(cancel.params.get("prorate")).toBe("false");
    expect(await row()).toMatchObject({ stripeSubscriptionId: "sub_1" });
  });

  it("acknowledges an Adeli customer's event quietly, with no row and no alert", async () => {
    const stripe = fakeStripe();
    vi.stubEnv("SLACK_BILLING_ALERT_WEBHOOK_URL", SLACK);
    const warn = vi.spyOn(console, "warn");
    stripe.addCustomer("cus_adeli", { adeli_organization_id: "org_1" });
    stripe.setSubscription({ id: "sub_adeli", customer: "cus_adeli", status: "active" });
    expect((await POST(subscriptionEvent("customer.subscription.created", "sub_adeli"))).status).toBe(200);
    expect(await db().select().from(schema.billingCustomers)).toHaveLength(1);
    expect(stripe.slack).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("finds a user from the customer's metadata when their row is missing", async () => {
    const stripe = fakeStripe();
    await db().delete(schema.billingCustomers);
    stripe.addCustomer("cus_9", { ledachat_user_id: USER });
    stripe.setSubscription({ id: "sub_9", customer: "cus_9", status: "active" });
    await POST(subscriptionEvent("customer.subscription.created", "sub_9"));
    expect(await row()).toMatchObject({ stripeCustomerId: "cus_9", subscriptionStatus: "active" });
  });

  it("alerts the first payment once, and again only if Slack failed", async () => {
    const stripe = fakeStripe();
    vi.stubEnv("SLACK_BILLING_ALERT_WEBHOOK_URL", SLACK);
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    await POST(subscriptionEvent("customer.subscription.created"));
    await vi.waitFor(() => expect(stripe.slack).toHaveLength(1));
    const paid = (id: string) => signedWebhook({ id, type: "invoice.paid", data: { object: { object: "invoice", id: `in_${id}`, customer: "cus_1", amount_paid: 2500, amount_due: 2500, parent: { subscription_details: { subscription: "sub_1" } } } } });
    stripe.failSlack();
    await POST(paid("evt_paid_1"));
    expect((await row()).firstPaymentAlertedAt).toBeNull();
    stripe.failSlack(200);
    await POST(paid("evt_paid_2"));
    await POST(paid("evt_paid_3"));
    expect((await row()).firstPaymentAlertedAt).not.toBeNull();
    const firstPayments = stripe.slack.filter((message) => message.text.includes("first payment"));
    expect(firstPayments).toHaveLength(2);
    expect(firstPayments[1].text).toContain("$25.00");
  });
});

describe("reconcileSubscription", () => {
  it("repairs a missed webhook once, then waits a minute", async () => {
    const stripe = fakeStripe();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "active" });
    const now = Date.now();
    expect(await reconcileSubscription(getStripe(), USER, now)).toBe(true);
    expect(await getPlan(USER)).toBe("pro");
    await db().update(schema.billingCustomers).set({ subscriptionStatus: null });
    expect(await reconcileSubscription(getStripe(), USER, now + 1000)).toBe(false);
    expect(stripe.calls("GET", "/subscriptions")).toHaveLength(1);
    error.mockRestore();
  });

  it("ends Pro whose period passed with no webhook, by re-reading the subscription", async () => {
    const stripe = fakeStripe();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const now = Date.now();
    await db().update(schema.billingCustomers).set({ stripeSubscriptionId: "sub_1", subscriptionStatus: "active", currentPeriodEnd: new Date(now - 3 * 86_400_000) });
    stripe.setSubscription({ id: "sub_1", customer: "cus_1", status: "canceled" });
    expect(await reconcileSubscription(getStripe(), USER, now)).toBe(true);
    expect(await getPlan(USER)).toBe("free");
    expect(stripe.calls("GET", "/subscriptions/sub_1")).toHaveLength(1);
    error.mockRestore();
  });

  it("leaves a current Pro subscription alone, without calling Stripe", async () => {
    const stripe = fakeStripe();
    await db().update(schema.billingCustomers).set({ stripeSubscriptionId: "sub_1", subscriptionStatus: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    expect(await reconcileSubscription(getStripe(), USER)).toBe(false);
    expect(stripe.requests).toHaveLength(0);
  });

  it("does nothing for a user who never started checkout", async () => {
    const stripe = fakeStripe();
    await db().delete(schema.billingCustomers);
    expect(await reconcileSubscription(getStripe(), USER)).toBe(false);
    expect(stripe.requests).toHaveLength(0);
  });
});
