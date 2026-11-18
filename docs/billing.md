# Billing

How LedaChat's Stripe billing works. The design and its reasoning are in [`tmp/2026-11-17-stripe-billing-plan.md`](../tmp/2026-11-17-stripe-billing-plan.md). It copies the shape and safety rules of Adeli's billing (`~/repos/adeli/docs/billing.md`), without Adeli's usage metering.

## The model

| | Free | Pro |
| --- | --- | --- |
| Price | $0 | $25 a month, plus tax where it applies |
| Live automations | 10 at once | Unlimited |
| Branding | "Powered by LedaChat" is sent as its own message after the Final DM | None |
| Message earlier comments | No | Yes |

Plans live in `packages/ui/src/billing/plans.ts`, which both the app and the landing page read. Drafts and paused automations are never limited.

**Pro** is an active Stripe subscription, or `user_settings.plan = 'pro'` set by hand for a comped user (`isPro`, `apps/web/src/lib/billing/state.ts`).

**The limit is a property of the install.** With `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set (the hosted LedaChat), Free users are limited. Without them (local development, every self-hosted install), `getPlan` returns `unlimited`, nothing is limited, and Settings shows no Plan card. Self-hosters should leave both empty. **Branding is separate:** it follows `LEDACHAT_BRANDING` (on unless `off`), so a self-hosted install sets `LEDACHAT_BRANDING=off` to drop it.

## Configuration

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | A restricted key (`rk_...`), see below. A publishable key (`pk_...`) is rejected. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the webhook endpoint below. |
| `SLACK_BILLING_ALERT_WEBHOOK_URL` | Optional. Slack incoming webhook for billing alerts (the same one as Adeli's). |
| `SLACK_SIGNUP_WEBHOOK_URL` | Optional. Slack incoming webhook for #dopamine-hits: sign-ups and go-lives (the same one as Adeli's sign-up alerts). |

**The app's restricted key** needs only:

- **Write:** Customers, Checkout Sessions, Customer portal, Subscriptions (cancelling a duplicate);
- **Read:** Prices, Products, Invoices, Tax settings.

Make one per environment, for LedaChat only, so it can be rolled without touching Adeli. In Vercel, add the Stripe variables as [sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

The client is `getStripe()` (`apps/web/src/lib/billing/stripe.ts`), pinned to API version `2026-10-28.endive`, in which a subscription's period lives on its items. It sends through the global `fetch`, so tests drive it with a fake (`apps/web/test/fake-stripe.ts`) and never call Stripe.

## Stripe objects

LedaChat shares King's Cross Labs' Stripe account with Adeli. Everything LedaChat owns is tagged so the two never mix:

| Object | How code finds it |
| --- | --- |
| Product "Leda Chat Pro" (tax code `txcd_10103001`, statement descriptor `LEDACHAT PRO`) | `metadata.ledachat_key = ledachat_pro` |
| Price, $25.00 USD monthly, `tax_behavior: exclusive` | Lookup key `ledachat_pro_monthly` (`resolvePriceId`); code never uses a price id |
| Customer Portal configuration: card, address, name, email, tax id, invoices, and cancelling at period end; plan switching off | `metadata.ledachat_key = ledachat_billing_portal`, passed explicitly on every portal session (the account's default belongs to Adeli) |
| Customers | `metadata.ledachat_user_id` |

`apps/web/scripts/stripe-bootstrap.mjs` creates them, once per Stripe account and mode:

```bash
# Report what exists, what's missing, and any drift. Changes nothing.
node apps/web/scripts/stripe-bootstrap.mjs
# Create what's missing, with a key that can write products, prices and portal settings.
STRIPE_SECRET_KEY=sk_... node apps/web/scripts/stripe-bootstrap.mjs --apply
```

The app's restricted key can't create these on purpose; pass a broader key for that one command and never put it in Vercel. The script reports `PRICE DIFFERS` when the live price no longer matches the plans, and whether Stripe Tax has an active registration. **Without one, Stripe collects $0 tax and raises no error.** Every `--apply` overwrites the portal configuration, so change its settings in the script, not the Dashboard.

**Changing the price:** a used Stripe price can't change. Update `plans.ts`, create a new price, move the lookup key to it (`transfer_lookup_key`), and move existing subscriptions.

**What sharing the account means:** Checkout and receipts show the account's name and branding, and only the line item says "Leda Chat Pro". Both apps' webhook endpoints receive both apps' events, so each ignores customers that aren't its own: LedaChat acknowledges an event for a customer without `ledachat_user_id` (and no `billing_customers` row) with `200`, silently.

## Coupons

Checkout accepts promotion codes (`allow_promotion_codes`). Live mode has a tester coupon, "Leda Chat Tester Code" (`BOaW542Y`: 100% off, forever, limited to Leda Chat Pro, `metadata.ledachat_key = ledachat_tester`), with the promotion code `LF58GZ2E`. A 100% subscription is still `active`, so its user is Pro. Adeli's own "Tester Code" isn't limited to a product, so its code works here too. Make coupons in the Stripe Dashboard; the app needs no change for a new one.

## State in Postgres

`billing_customers`, one row per user who has started checkout, keyed by `user_id`: Stripe customer and subscription ids, the subscription's status verbatim, `cancel_at_period_end`, `current_period_end` (or the cancellation date), `tax_location_invalid`, and `first_payment_alerted_at`. Free users who never started checkout have no row. `processed_stripe_events` holds handled event ids.

`getPlan(userId)` (`apps/web/src/lib/billing/state.ts`) reads only that row: Pro while the status is `active`, `trialing` or `past_due`. `past_due` is deliberate: while Stripe retries a card, the user keeps Pro.

**Cancelling.** The portal cancels at the end of the paid period: Stripe keeps the subscription `active` and sets `cancel_at` (or `cancel_at_period_end`), which LedaChat stores as `cancel_at_period_end` with the end date in `current_period_end`, and Settings shows "Pro until <date>". At that date Stripe ends it and sends `customer.subscription.deleted`, which makes the user Free. `planOf` also stops counting a cancelled subscription as Pro once its end date passes, so Pro ends on time even if that webhook is missed.

## Webhook

`POST /api/stripe/webhook` (`apps/web/src/app/api/stripe/webhook/route.ts`, logic in `apps/web/src/lib/billing/webhook.ts`). Subscribe the endpoint to:

`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalization_failed`, `customer.updated`.

1. Verifies `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` (`400` if not; `503` when billing is off).
2. Claims the event id in `processed_stripe_events`; a redelivery is acknowledged and skipped.
3. Handles it. On a failure it releases the claim and returns `500`, so Stripe retries for up to three days.

Subscription and invoice events re-read the subscription from Stripe and mirror it (Stripe doesn't guarantee event order). An event for an older subscription never overwrites a newer active one. **One subscription per user:** a second active one (two checkouts finished at once) is cancelled with `invoice_now: false, prorate: false` once Stripe confirms the recorded one is still active. `startCheckout` also asks Stripe whether the user already subscribes, sending them to the portal if so, and expires their open checkouts before creating one.

**A missed webhook** is repaired when the user opens Settings, by `reconcileSubscription`, at most once a minute per user, in both directions:
- no active subscription on record: it asks Stripe for an active one and mirrors it, so a payer isn't left on Free (logs `was never mirrored by a webhook`);
- an active subscription more than a day past its period end: it re-reads that subscription, which either renews the period or ends Pro (logs `is past its period end with no webhook since`).

Either log means the endpoint is broken: fix it rather than relying on the repair.

## The live automation limit

`goLive` (`apps/web/src/lib/automations/service.ts`) is the only code that puts an automation live, for both the app and MCP's `go_live`. When the automation wasn't live already, it counts the user's live automations under a per-user advisory lock (so two Go Lives at 9 can't both pass) and refuses at the plan's limit with `reason: "limit"` and `upgradeUrl` (`/settings#plan`). Saving or re-going-live an automation that's already live is never refused.

**Message earlier comments** sends only on Pro: `messageEarlierComments` in the same service refuses a Free user with `reason: "pro"` and `upgradeUrl`, for the app and MCP's `message_earlier_comments` alike. `previewEarlierComments` counts on every plan and says `allowed: false`, so Free users see who they would reach and get the upgrade offer. An install without billing allows it.

When Pro ends, nothing is paused. Everything live stays live, and nothing more can go live until fewer than 10 are.

## Branding

After a Free user's Final DM is sent, `sendFinalDm` (`apps/web/src/lib/runtime/handle.ts`) sends "Powered by LedaChat" (`BRANDING_TEXT`) as its own message, when `showsBranding` (`apps/web/src/lib/plan.ts`) says so: `LEDACHAT_BRANDING` isn't `off`, and the user isn't Pro. A failed branding send doesn't fail the run. Nothing else is branded. The editor preview shows the message for the same users (PRD FR-5.22).

## Settings

The Plan card (`apps/web/src/components/settings/plan-card.tsx`, anchor `#plan`) shows Free (`n of 10 live automations`, **Upgrade to Pro**) or Pro (renewal or end date, **Manage billing**), plus alerts for a failed payment or an address Stripe Tax can't place. Upgrade is the `startCheckout` Server Action; Manage billing is `openBillingPortal`. Both take nothing from the browser.

## Slack alerts

All optional, best-effort (sent after the response, never retried, never failing the action), and titled "LedaChat" because the channels also carry Adeli's alerts:

| Alert | Webhook | When |
| --- | --- | --- |
| New Pro subscription, with a Stripe customer link | `SLACK_BILLING_ALERT_WEBHOOK_URL` | A subscription becomes active (also through reconcile) |
| First payment | same | The first paid invoice with money in it; recorded only once Slack accepts it |
| Payment failed | same | `invoice.payment_failed` |
| Cancelled, with the end date | same | The user cancels in the portal |
| Ended | same | The subscription becomes `canceled` or `unpaid` |
| New sign-up | `SLACK_SIGNUP_WEBHOOK_URL` (#dopamine-hits) | Better Auth's `user.create.after` hook |
| Automation went live: user, handle, automation name, type, trigger, "via MCP", and "First automation!" | same | `goLive`, from draft or paused only |

Alerts name the LedaChat user (name, email, Instagram handle). They never include a commenter's or lead's details, or DM text.

## Testing it by hand

1. Put sandbox values in `apps/web/.env.local`: a restricted or secret test key, and the secret `stripe listen` prints.
2. `stripe listen --forward-to localhost:3030/api/stripe/webhook`, then `yarn dev`.
3. Settings shows the Plan card. Upgrade with card `4242 4242 4242 4242`; the card shows Pro.
4. Cancel in Manage billing; the card says "Pro until ...". Use a Stripe test clock to pass the period end and see Free return.
