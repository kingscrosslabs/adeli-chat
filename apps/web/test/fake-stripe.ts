import Stripe from "stripe";
import { vi } from "vitest";

import { resetStripeCaches } from "@/lib/billing/stripe";
import { resetReconcileThrottle } from "@/lib/billing/webhook";

export const STRIPE_KEY = "rk_test_ledachat";
export const WEBHOOK_SECRET = "whsec_test_ledachat";

export type StripeRequest = { method: string; path: string; params: URLSearchParams };
type Subscription = { id: string; customer: string; status: string; cancel_at_period_end?: boolean; cancel_at?: number | null; current_period_end?: number };

/**
 * A fake Stripe behind the global `fetch` (the app's Stripe client sends
 * through it), with billing turned on. Slack webhook URLs are answered too,
 * and recorded in `slack`. Everything else gets a 404.
 */
export function fakeStripe() {
  vi.stubEnv("STRIPE_SECRET_KEY", STRIPE_KEY);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  resetStripeCaches();
  resetReconcileThrottle();
  const requests: StripeRequest[] = [];
  const slack: Array<{ url: string; text: string }> = [];
  const customers = new Map<string, { id: string; metadata: Record<string, string> }>();
  const subscriptions = new Map<string, Subscription>();
  const openSessions: Array<{ id: string; mode: string; customer: string }> = [];
  let slackStatus = 200;
  let counter = 0;

  function subscriptionBody(subscription: Subscription) {
    return {
      object: "subscription",
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      cancel_at: subscription.cancel_at ?? null,
      start_date: 1_700_000_000,
      items: { object: "list", data: [{ id: `si_${subscription.id}`, current_period_start: 1_700_000_000, current_period_end: subscription.current_period_end ?? 1_800_000_000 }] },
    };
  }

  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "hooks.slack.com") {
      slack.push({ url: url.toString(), text: (JSON.parse(await request.text()) as { text: string }).text });
      return new Response("ok", { status: slackStatus });
    }
    if (url.hostname !== "api.stripe.com") return new Response("not found", { status: 404 });
    const text = request.method === "GET" ? "" : await request.text();
    const body = text ? new URLSearchParams(text) : url.searchParams;
    const path = url.pathname.replace(/^\/v1/, "");
    requests.push({ method: request.method, path, params: body });
    const json = (value: unknown, status = 200) => Response.json(value, { status });
    const list = (data: unknown[]) => json({ object: "list", data, has_more: false, url: path });

    if (path === "/customers" && request.method === "POST") {
      counter += 1;
      const metadata: Record<string, string> = {};
      for (const [name, value] of body) {
        const match = /^metadata\[(.+)\]$/.exec(name);
        if (match) metadata[match[1]] = value;
      }
      const customer = { id: `cus_${counter}`, metadata };
      customers.set(customer.id, customer);
      return json({ object: "customer", ...customer });
    }
    const customerMatch = /^\/customers\/([^/]+)$/.exec(path);
    if (customerMatch) {
      const customer = customers.get(customerMatch[1]);
      return customer ? json({ object: "customer", ...customer, tax: { automatic_tax: "supported" } }) : json({ error: { type: "invalid_request_error", code: "resource_missing", message: "No such customer" } }, 404);
    }
    if (path === "/subscriptions" && request.method === "GET") {
      return list([...subscriptions.values()].filter((subscription) => subscription.customer === body.get("customer")).map(subscriptionBody));
    }
    const cancelMatch = /^\/subscriptions\/([^/]+)$/.exec(path);
    if (cancelMatch && request.method === "DELETE") {
      const subscription = subscriptions.get(cancelMatch[1])!;
      subscription.status = "canceled";
      return json(subscriptionBody(subscription));
    }
    if (cancelMatch) {
      const subscription = subscriptions.get(cancelMatch[1]);
      return subscription ? json(subscriptionBody(subscription)) : json({ error: { type: "invalid_request_error", code: "resource_missing", message: "No such subscription" } }, 404);
    }
    if (path === "/prices") return list([{ object: "price", id: "price_pro", lookup_key: "ledachat_pro_monthly" }]);
    if (path === "/billing_portal/configurations") return list([{ object: "billing_portal.configuration", id: "bpc_adeli", metadata: { adeli_key: "adeli_billing_portal" } }, { object: "billing_portal.configuration", id: "bpc_ledachat", metadata: { ledachat_key: "ledachat_billing_portal" } }]);
    if (path === "/billing_portal/sessions") return json({ object: "billing_portal.session", id: "bps_1", url: "https://billing.stripe.com/p/session_1" });
    if (path === "/checkout/sessions" && request.method === "GET") return list(openSessions.filter((session) => session.customer === body.get("customer")).map((session) => ({ object: "checkout.session", ...session, status: "open" })));
    const expireMatch = /^\/checkout\/sessions\/([^/]+)\/expire$/.exec(path);
    if (expireMatch) return json({ object: "checkout.session", id: expireMatch[1], status: "expired" });
    if (path === "/checkout/sessions") return json({ object: "checkout.session", id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new" });
    return json({ error: { type: "invalid_request_error", message: `fake Stripe has no ${request.method} ${path}` } }, 404);
  });
  vi.stubGlobal("fetch", fetch);

  return {
    fetch,
    requests,
    slack,
    failSlack: (status = 500) => { slackStatus = status; },
    addCustomer(id: string, metadata: Record<string, string> = {}) {
      customers.set(id, { id, metadata });
    },
    setSubscription(subscription: Subscription) {
      subscriptions.set(subscription.id, subscription);
    },
    addOpenSession(id: string, customer: string, mode = "subscription") {
      openSessions.push({ id, customer, mode });
    },
    calls: (method: string, path: string) => requests.filter((request) => request.method === method && request.path === path),
  };
}

/** A signed webhook request, as Stripe would send it. */
export function signedWebhook(event: { id: string; type: string; data: { object: unknown } }, secret = WEBHOOK_SECRET): Request {
  const payload = JSON.stringify({ object: "event", api_version: "2026-10-28.endive", created: Math.floor(Date.now() / 1000), ...event });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body: payload });
}
