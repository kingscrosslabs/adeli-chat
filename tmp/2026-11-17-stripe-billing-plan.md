---
status: proposed
date: 2026-11-17
---

# Stripe Billing Plan

## Context

The landing page (`apps/landing-page/src/components/landing-page.tsx`, `Options()` at `:321`) sells three options, and every button is still "Join waitlist" (`WAITLIST_URL`, the Tally form):

| | Free | Pro | Self-host |
| --- | --- | --- | --- |
| Price | $0 forever | $25 per month | Free, MIT license |
| Live automations | 10 (`FREE_AUTOMATIONS`, `:20`) | "Everything in Free" | Unlimited |
| Branding | "LedaChat branding in the last DM" | "Remove branding" | None |
| Features, MCP | All | All | All |

The app enforces none of this. Any user can put any number of automations live, no DM carries branding, and there is no way to pay. The PRD still lists billing as out of scope (`docs/PRD.md:50`).

Done means: on the hosted install, a Free user can have at most 10 live automations and their final DM carries a short LedaChat line; they can pay $25 a month through Stripe Checkout, which removes both; they manage or cancel through the Stripe Customer Portal; and an install without Stripe keys (local dev, every self-host) behaves exactly as today, with no limit and no branding.

The billing machinery is copied, in shape and in its safety rules, from Adeli's (`~/repos/adeli/apps/web/lib/billing/`, `docs/billing.md`, `plans/2026-10-06-stripe-billing-plan.md`). LedaChat needs a small subset of it.

## What we take from Adeli, and what we leave

| Adeli piece | Where in Adeli | LedaChat |
| --- | --- | --- |
| `getStripeConfig()` returns `null` without keys, so billing is off | `lib/env.ts` | **Take.** It is also how self-host stays unlimited. |
| `getStripe()` pinned to `2026-10-28.endive`, `stripeCall` wrapper | `lib/billing/stripe.ts` | **Take**, without Adeli's telemetry package. |
| Prices found by lookup key (`resolvePriceId`), portal config by metadata tag | `lib/billing/stripe.ts` | **Take.** Test and live mode run the same code. |
| `scripts/stripe-bootstrap.mjs`: creates product, price, portal config; dry run by default | `apps/web/scripts/` | **Take**, much shorter: one product, one price, one portal config. No meters. |
| `billing_customers`, one row per workspace, mirrored from webhooks | `lib/db/schema.ts:1715` | **Take**, keyed by `user_id` (D2: every user is their own workspace). |
| Webhook: verify, claim event id, always re-read the subscription, release the claim and `500` on failure | `app/api/stripe/webhook/route.ts`, `lib/billing/webhook.ts` | **Take.** LedaChat has no `processed_webhook_events` table, so add one. |
| One subscription per customer: check Stripe before Checkout, expire open sessions, cancel a duplicate in `syncSubscription` | `lib/billing/checkout.ts:46`, `webhook.ts:80` | **Take.** A duplicate here charges $25 twice instead of double-metering, but it is the same bug. |
| `reconcileSubscription` on page load, at most once a minute | `webhook.ts:167` | **Take.** It is what saves a paying user when a webhook never arrives. |
| `past_due` counts as active (grace while Stripe retries the card) | `lib/billing/status.ts` | **Take.** |
| Stripe Checkout with `automatic_tax`, address and tax id collection | `checkout.ts` | **Take** (agreed). |
| Account-day metering, `billing_account_days`, meters, daily cron, threshold charges, carry-in | `account-days.ts`, `thresholds.ts`, `internal/billing/daily` | **Leave.** Pro is a flat licensed price. Nothing is metered, so no cron. |
| X usage item, usage counters, Slack alerts, organizations and roles | various | **Leave.** |
| Portal with cancelling **off** | `stripe-bootstrap.mjs:167` | **Change.** Adeli turned it off because a cancelled metered subscription leaves usage unbilled. A flat $25 has no such problem, so cancelling is **on**, at period end. |

## Findings that change the approach

- **There is one choke point for going live.** `goLive` in `apps/web/src/lib/automations/service.ts:105` is the only code that sets `status: "live"`, and both the app's Server Actions and MCP's `go_live` (`apps/web/src/lib/mcp/server.ts:339`) call it. The limit lives there and nowhere else, which CLAUDE.md already requires ("never write automations from MCP code directly").
- **There is one place a final DM is sent.** `sendFinalDm` in `apps/web/src/lib/runtime/handle.ts:327` sends every "last DM", whether the run went through a button tap, an email or a follow gate. Branding goes there, not into stored automation content, so upgrading or cancelling changes behaviour at once with no data migration.
- **The final DM has no room for a suffix today.** Its text can be 640 characters (`LIMITS.dmText`, `packages/ui/src/automation/schemas.ts:15`), which is Instagram's limit. Appending a line to a 640-character DM would fail at Instagram. See 2.2.
- **Self-host must stay unlimited, and that falls out for free.** Every self-hosted install runs without Stripe keys, so `getStripeConfig()` is `null` and every check passes. Nobody needs a "self-host mode" flag. The README must say so, so a self-hoster never sets Stripe keys by accident.
- **The Stripe account's name is what Checkout, receipts and card statements show.** LedaChat shares King's Cross Labs' account, so buyers see that name on the payment page. See "Sharing Adeli's Stripe account".
- **Tests can drive Stripe through the fake `fetch`.** CLAUDE.md says tests use a fake `fetch`. The `stripe` package uses Node's HTTP client by default, which the fake doesn't see. Build the client with `httpClient: Stripe.createFetchHttpClient((...args) => fetch(...args))` so every request goes through the global `fetch` at call time, and the existing test style works with no Stripe mock. Webhook tests sign payloads with `stripe.webhooks.generateTestHeaderString`.
- **Two concurrent `goLive` calls can both pass at 9 live.** Count then update is a race (an agent going live with several automations at once through MCP is the realistic case). Take a per-user `pg_advisory_xact_lock` inside a transaction. Verify PGlite supports it in tests before relying on it; if not, fall back to `SELECT ... FOR UPDATE` on the user's `user_settings` row.

## Decisions

### Agreed (2026-11-17)

- **Pro removes the 10-automation limit.** Pro is unlimited live automations plus no branding. The Pro card gains "Unlimited automations" as its first point, which also settles the card's disagreement with the comparison table ("Free for 10 automations, then $25/month", `landing-page.tsx:245`).
- **When Pro ends, nothing is paused.** (Cancelled at period end, or `unpaid` after Stripe gives up on the card. Not `past_due`.) Everything live stays live, and no automation can go live until fewer than 10 are. It matches the FAQ ("Your 10 live automations keep running. Pause one to start another.") and never stops a creator's automation mid-campaign. The abuse case (pay one month, go live with 50, cancel) is cheap to tolerate now; pausing the most recent ones down to 10 closes it later if needed.
- **A new Stripe product in King's Cross Labs' existing Stripe account**, not a new account. See "Sharing Adeli's Stripe account" below for what that implies.
- **Stripe Tax on**, as in Adeli (`automatic_tax`, required billing address, tax id collection), with `tax_behavior: "exclusive"` so $25 is before tax. Without an active registration it collects $0 silently, so this costs nothing until registrations are added.
- **Slack alerts reuse Adeli's webhooks.** Billing alerts go to the same Slack incoming webhook as Adeli's (`SLACK_BILLING_ALERT_WEBHOOK_URL`), and sign-ups and automations going live go to #dopamine-hits through the same webhook as Adeli's sign-up alerts (`SLACK_SIGNUP_WEBHOOK_URL`). See Milestone 3.

### Still open

- **Branding copy.** Proposed: a blank line, then `Sent with LedaChat (ledachat.com)`. No em dash (copy rule). Instagram makes the domain tappable in DMs.

## Sharing Adeli's Stripe account

Created in the King's Cross Labs sandbox (`acct_1UNdi4CyqHt6eCrL`) on 2026-11-17 with the Stripe CLI:

| Object | Id | Details |
| --- | --- | --- |
| Product "LedaChat Pro" | `prod_Ve8SbYmMyUHnv8` | Tax code `txcd_10103001`, statement descriptor `LEDACHAT PRO`, `metadata.ledachat_key = ledachat_pro` |
| Price | `price_1UcqBkCyqHt6eCrLAStlXwSo` | Lookup key `ledachat_pro_monthly`, $25.00 USD monthly, `tax_behavior: exclusive` |

The portal configuration isn't created yet; the bootstrap script (0.1) creates it, finds the product and price above by `ledachat_key` and lookup key, and does the same in live mode. Code never uses these ids, only the lookup key.

What one account means:

- **Checkout and receipts show the account's name and branding** (King's Cross Labs, and whatever logo and colour are set under Settings, Branding). Only the line item says "LedaChat Pro". Card statements show the product's descriptor, `LEDACHAT PRO`, where the card network allows a product-level descriptor.
- **Each app's webhook endpoint receives the other's events.** Stripe endpoints subscribe to event types, not products, so Adeli's endpoint gets LedaChat's subscription events and the other way round.
  - LedaChat's handler ignores, without logging a warning, any customer it can't map to a user (no `billing_customers` row and no `metadata.ledachat_user_id`), and acknowledges with `200`.
  - Adeli's `resolveOrganizationId` (`~/repos/adeli/apps/web/lib/billing/webhook.ts:62`) already returns `null` for a customer with no Adeli metadata, but `syncSubscription` then logs `Stripe subscription has no Adeli organization` at warn level for every LedaChat event. **Small Adeli change:** skip quietly when the customer's metadata has `ledachat_user_id`.
- **Restricted keys are account-wide.** LedaChat's restricted key can read and write Adeli's customers and subscriptions too. Use a separate restricted key per app (so either can be rolled alone), and never use one app's key in the other.
- **One Customer Portal per app** is fine: configurations are found by their metadata tag and passed explicitly on every portal session (Adeli already does this, `resolvePortalConfigurationId`), so neither app relies on the account default.
- **Tax registrations and payouts are shared** with Adeli.

## Approach

1. **Billing is a property of the install.** With `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set, users have a plan; without them, everyone is unlimited and unbranded, exactly as today.
2. **A user's plan is read from Postgres, never from Stripe at request time.** `billing_customers` mirrors the subscription from webhooks (and from `reconcileSubscription` when a webhook is missed). `goLive` and `sendFinalDm` read only that row, so a Stripe outage never stops an automation.
3. **The plans live in one shared module**, `packages/ui/src/billing/plans.ts`, so the landing page's prices and limits and the app's enforcement can't drift (`FREE_AUTOMATIONS` moves there).
4. **Stripe owns payment UI.** Checkout to subscribe, the Customer Portal to change card, see invoices or cancel. LedaChat builds one Plan card in Settings, not a billing page.
5. **Monthly only.** No annual price, trials or coupons in this plan (see Non-goals).

---

# Milestone 0 - Stripe foundation

Nothing user-visible. It lands config, the client, the table and the webhook, so a subscription created by hand in the Stripe Dashboard is already mirrored correctly before any button exists.

## 0.1 Config, client, bootstrap

- `apps/web/package.json` - add `stripe` (`^23.1.0`, Adeli's version, so `2026-10-28.endive` is supported).
- `apps/web/src/lib/billing/config.ts` - **new.** `getStripeConfig()`: `{ secretKey, webhookSecret }` when both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set, else `null`. Rejects a publishable key (`pk_`) with a clear error, as Adeli does. `billingEnabled()` is `getStripeConfig() !== null`. Server-only.
- `apps/web/src/lib/billing/stripe.ts` - **new.** `getStripe()` (cached per key, `apiVersion: "2026-10-28.endive"`, `maxNetworkRetries: 2`, `appInfo: { name: "ledachat" }`, fetch HTTP client per Findings), `stripeCall(operation, fn)` that logs failures with the operation name and never an id, `resolvePriceId(lookupKey)`, `resolvePortalConfigurationId()`. Constants: `STRIPE_LOOKUP_KEYS = { proMonthly: "ledachat_pro_monthly" }`, `PORTAL_CONFIGURATION_KEY = "ledachat_billing_portal"`. In this API version a subscription's period is on its items, not the subscription.
- `apps/web/src/lib/billing/status.ts` - **new.** `isActiveSubscriptionStatus`: `active`, `trialing`, `past_due`. Copied from Adeli with its comment.
- `apps/web/scripts/stripe-bootstrap.mjs` - **new.** Reports by default, `--apply` creates what's missing:
  - product "LedaChat Pro", `metadata.ledachat_key = ledachat_pro`, tax code `txcd_10103001` (SaaS, business use; same as Adeli);
  - price, lookup key `ledachat_pro_monthly`, `unit_amount: 2500`, `currency: usd`, `recurring.interval: month`, `tax_behavior: exclusive`. Prints `PRICE DIFFERS` when the live price's amount isn't the one in `packages/ui/src/billing/plans.ts`;
  - portal configuration tagged `ledachat_billing_portal`: payment method, address, name, email, tax id updates, invoice history, and `subscription_cancel: { enabled: true, mode: "at_period_end" }`. Plan switching off (there is one plan). Every `--apply` overwrites it, as in Adeli;
  - a read-only check of tax settings and registrations.
  It reads `STRIPE_SECRET_KEY` from the environment before `apps/web/.env.local`, so a broader key can be passed for one run. It never touches customers or subscriptions.
- `apps/web/.env.example` - add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` under a "Billing (hosted LedaChat only; leave empty to self-host)" comment.

## 0.2 Billing state

- `apps/web/src/lib/db/schema.ts` - **new tables:**
  - `billing_customers`: `user_id` (PK, references `auth_user`, cascade), `stripe_customer_id` (unique), `stripe_subscription_id` (unique, nullable), `subscription_status` (Stripe's, verbatim), `cancel_at_period_end` (boolean), `current_period_end`, `has_payment_method`, `tax_location_invalid`, timestamps. Same shape as Adeli's minus threshold, X and alert columns.
  - `processed_stripe_events`: `event_id` PK, `received_at`. (Adeli shares `processed_webhook_events` with Meta; LedaChat's Adeli webhooks dedupe on run keys instead, so this table is Stripe's alone.)
- `apps/web/drizzle/0010_stripe_billing.sql` - **new**, via `yarn workspace @adeli-chat/web db:generate`. `vercel-build` already runs `db:migrate`.
- `apps/web/src/lib/billing/state.ts` - **new.** `getBillingCustomer(userId)` and `getPlan(userId)`: `"unlimited"` when billing is off, `"pro"` when the subscription status is active, else `"free"`. `liveAutomationLimit(plan)` and `brandsFinalDm(plan)` read `PLANS`. Never calls Stripe.
- `packages/ui/src/billing/plans.ts` - **new**, and `"./billing/*"` added to `packages/ui/package.json` `exports`. `PLANS = { free: { priceCents: 0, liveAutomations: 10, branding: true }, pro: { priceCents: 2500, liveAutomations: null, branding: false } }`, plus `BRANDING_LINE`. Imports nothing from either app.

## 0.3 Webhook

- `apps/web/src/app/api/stripe/webhook/route.ts` - **new.** `runtime = "nodejs"`, reads the raw body, `503` when billing is off, `400` on a missing or bad `Stripe-Signature`, then claim, handle, and on failure release the claim and return `500` so Stripe retries. `src/proxy.ts` needs **no change**: its matcher already excludes `api/`.
- `apps/web/src/lib/billing/webhook.ts` - **new.** `claimStripeEvent`, `releaseStripeEvent`, `syncSubscription(subscriptionId)`, `reconcileSubscription(userId)`, `handleStripeEvent(event)`:

  | Event | Effect |
  | --- | --- |
  | `checkout.session.completed`, `customer.subscription.created` / `.updated` / `.deleted`, `invoice.paid`, `invoice.payment_failed` | Re-read the subscription and mirror it. An event for an older subscription never overwrites a newer active one; a second active subscription is cancelled without invoicing when Stripe confirms the recorded one is still active (Adeli's rule, verbatim). |
  | `invoice.finalization_failed` with `requires_location_inputs` | Set `tax_location_invalid`. |
  | `customer.updated` | Re-read the tax location and clear the flag once Stripe can place them. |

  The user is found by `billing_customers.stripe_customer_id`, else by the customer's `metadata.ledachat_user_id` (checked against `auth_user`). It tracks `subscription_started` and `subscription_ended` (analytics, keyed by user id) on the transitions, not on every event.

# Milestone 1 - Checkout, portal and the Plan card

## 1.1 Checkout and portal

- `apps/web/src/lib/billing/checkout.ts` - **new.**
  - `ensureStripeCustomer(user)`: the user's row, or a new customer (`email`, `name`, `metadata.ledachat_user_id`) created with an idempotency key from the user id and a hash of the params, then recorded.
  - `startCheckout(user)`: if the row or Stripe (`subscriptions.list`, `active`, `trialing`, `past_due` or `incomplete`) says they already subscribe, return a portal URL instead. Otherwise expire their open subscription Checkout sessions and create one: `mode: "subscription"`, one line item `{ price, quantity: 1 }`, `client_reference_id: userId`, `subscription_data.metadata.ledachat_user_id`, tax settings as agreed, `success_url` `/settings?checkout=success#plan`, `cancel_url` `/settings#plan`. URLs from `appUrl()` (`src/lib/app-url.ts`), never the request's host.
  - `openPortal(userId)`: a portal session on the tagged configuration, returning to `/settings#plan`.
- `apps/web/src/lib/actions.ts` - add `startCheckoutAction()` and `openBillingPortalAction()`. Both take nothing from the browser: the user comes from `requireUserId()`. Both return `{ url }` or an error result, and track `checkout_started` / `billing_portal_opened`.

## 1.2 Plan card in Settings

- `apps/web/src/app/(app)/settings/page.tsx` - also load `getPlan(user.id)` and the billing row, after `reconcileSubscription(user.id)` (throttled, never blocks the page: errors are logged and swallowed). It already computes `liveCount`.
- `apps/web/src/components/settings/plan-card.tsx` - **new**, rendered by `settings-view.tsx` with `id="plan"`, and only when billing is on. Built from `@adeli-chat/ui` `Card`, `Badge`, `Button`; tokens only.
  - **Free:** "Free", `n of 10 live automations`, a line that the final DM carries LedaChat branding, and **Upgrade to Pro, $25/month**.
  - **Pro:** "Pro", the renewal date or "Ends on <date>" when `cancel_at_period_end`, and **Manage billing**.
  - `past_due`: an alert to update the card, with **Manage billing**. `tax_location_invalid`: an alert to fix the billing address.
  - `?checkout=success`: a toast "You're on Pro." The webhook may land a second later, so the card shows Pro as soon as reconcile sees the subscription; if neither has, it says "Confirming your payment" and refreshes once.

# Milestone 2 - Enforcement

Lands after Milestone 1, so nobody is ever told to upgrade before they can.

## 2.1 The live automation limit

- `apps/web/src/lib/automations/service.ts` - `ActionResult` gains `{ ok: false; reason: "limit"; message: string; limit: number; upgradeUrl: string }`. In `goLive`, after `checkLive` passes and only when the automation isn't already live (saving a live one is never refused), inside a transaction holding a per-user advisory lock: count the user's live automations across their accounts, and refuse at the limit with "You have 10 live automations, the most on Free. Pause one, or upgrade to Pro for unlimited." `upgradeUrl` is `${appUrl()}/settings#plan`. `saveAutomation`, `duplicateAutomation` and `createAutomation` are **unchanged**: drafts are unlimited.
- `apps/web/src/lib/actions.ts` and the editor's and list's Go Live handlers - show the `limit` message with an **Upgrade** action that goes to `/settings#plan`. Track `automation_go_live_rejected` with `reason: "limit"`.
- `apps/web/src/lib/mcp/server.ts` - **no change to `go_live` logic**: it already returns `goLive`'s refusal. Add `plan`, `live_automation_limit` and `upgrade_url` to `get_workspace`, and one sentence to the server instructions (`:47`) so an agent explains the limit instead of retrying.

## 2.2 Branding in the final DM

- `packages/ui/src/automation/schemas.ts` - final DM text max becomes `LIMITS.dmText - BRANDING_LINE.length` for everyone, so a Pro user who cancels never has a DM that can't be branded. Before merging, query production for live or paused automations whose final DM is longer than the new max; if there are any, the send-time fallback below covers them.
- `apps/web/src/lib/runtime/handle.ts` - `sendFinalDm` reads the user's plan and, when `brandsFinalDm`, appends `BRANDING_LINE` to `finalDm.text`. If the result would pass 640 characters (an automation saved before the new max), send the final DM unchanged and then `BRANDING_LINE` as its own text message through the existing `sendText`. Opening DMs, follow gate, email prompts and comment replies are **not** branded: the site promises the last DM only. Track `final_dm_sent` with a new `branded` property.
- `packages/ui/src/preview/phone-preview.tsx` - new optional `branded` prop that renders the line under the final DM bubble (`:270`), so Free users see exactly what commenters get. The editor passes it from the plan; the landing page leaves it off.

# Milestone 3 - Slack alerts

Ported from Adeli's (`~/repos/adeli/apps/web/lib/billing/slack.ts`, `billing/payment-alert.ts`, `lib/onboarding-alert.ts`, `docs/signup-onboarding.md`). Every alert is best-effort: sent after the response with `after()` from `next/server` (as `src/lib/analytics/server.ts` already does), logged and never retried on failure, and never fails the sign-up, the webhook or the go-live. With its variable unset, nothing is sent and a warning is logged, exactly as in Adeli. Every message title starts with "LedaChat", because these channels already carry Adeli's alerts.

The messages include the user's name and email, which is fine for our own Slack (Adeli does the same). They never include a commenter's or lead's details, the same rule as analytics (CLAUDE.md).

## 3.1 Slack helper

- `apps/web/src/lib/slack.ts` - **new.** `postSlackWebhook(url, text)`: `POST` JSON `{ text }` with a 5-second timeout; throws on a non-2xx response. `escapeSlack(text)` escapes `&`, `<`, `>` (copied from `onboarding-alert.ts:14`). `slackWebhooks()` reads `SLACK_BILLING_ALERT_WEBHOOK_URL` and `SLACK_SIGNUP_WEBHOOK_URL`, trimmed, `null` when empty.
- `apps/web/.env.example` - both variables, commented as optional, with a note that the hosted install uses the same values as Adeli's.

## 3.2 Billing alerts (`SLACK_BILLING_ALERT_WEBHOOK_URL`)

- `apps/web/src/lib/billing/alerts.ts` - **new**, called from `handleStripeEvent` (0.3) and from `reconcileSubscription`, so a repaired subscription still alerts:
  - **Subscribed**, when a subscription becomes active: `:tada: *New LedaChat Pro subscription: <name>* (<email>)`, the Instagram handle when connected, and a link to the Stripe customer (`stripeCustomerUrl`, test or live by key).
  - **First payment**, on the first `invoice.paid` with `amount_paid > 0`: `:moneybag: *LedaChat first payment: $25.00* from <name>`. Sent once, recorded in `billing_customers.first_payment_alerted_at` (**new column**), set only after Slack accepts, as in Adeli.
  - **Cancelled**, when `cancel_at_period_end` turns on, and **Ended**, when the subscription is `canceled` or `unpaid`. Adeli has neither (it can't cancel), but they tell us who left and when.
  - **Payment failed**, on `invoice.payment_failed`, so someone can reach out while Stripe retries.

## 3.3 Sign-ups and go-lives (`SLACK_SIGNUP_WEBHOOK_URL`, #dopamine-hits)

- `apps/web/src/lib/alerts/dopamine.ts` - **new.** `alertSignup(user)` and `alertWentLive(userId, automation)`.
- `apps/web/src/lib/auth/server.ts` - in `databaseHooks.user.create.after` (`:69`), beside `track(user.id, "user_signed_up")`, call `alertSignup`: `:tada: *New LedaChat signup: <name>* (<email>)`. Not sent for the no-login `local` user, which never goes through this hook anyway.
- `apps/web/src/lib/automations/service.ts` - in `goLive`, only when the automation was not already live (a draft or paused automation going live, not a save of a live one), call `alertWentLive` after the update commits: `:rocket: *<name> put an automation live* (@<instagram handle>)`, then the automation's name, type (Comment to DM, Story Reply), and its trigger in words (the same `scopePhrase` the conflict message uses). One line for the user's first one ever: `:sparkles: First automation!` (no earlier `live_at` on any of their automations). Never the automation's DM text, which can carry a creator's private links or offers. Because MCP's `go_live` calls the same `goLive`, automations put live by Claude alert too, and say so (`via MCP`) from the `source` the analytics already passes.

## 3.4 Tests

- `apps/web/src/lib/alerts/dopamine.test.ts` - **new.** With the variable set, a sign-up posts one message with the escaped name; a go-live posts once, saving a live automation posts nothing, and "First automation!" appears only the first time; with it unset, nothing is fetched; a Slack `500` doesn't fail `goLive`.
- `apps/web/src/lib/billing/webhook.test.ts` - extend. Activation posts "Subscribed" once, including through reconcile; the first-payment alert posts once and retries when Slack failed the first time; an event for a customer with only Adeli metadata is acknowledged without an alert or a warning.

# Milestone 4 - Site, docs and PRD

- `apps/landing-page/src/components/landing-page.tsx` - `FREE_AUTOMATIONS` and the $25 come from `packages/ui/src/billing/plans.ts`. The Pro card gains "Unlimited automations". Whether the Free and Pro buttons switch from "Join waitlist" to the app's sign-in (`SIGN_IN_URL`) is a launch call, not part of this plan: leave `WAITLIST_URL` until you say so.
- `docs/billing.md` - **new**, the present-tense counterpart of this plan, in the shape of Adeli's: model, configuration and keys (a restricted key with write on Customers, Checkout Sessions, Customer portal, Subscriptions; read on Prices, Products, Invoices, Tax settings), Stripe objects, the bootstrap script, state, webhook events, the limit, branding, and "Billing is off without keys".
- `README.md` - a "Billing (hosted only)" section: self-hosters leave the Stripe variables empty and get unlimited automations with no branding; how the hosted install sets up its keys and webhook endpoint (`https://<app>/api/stripe/webhook`, events listed in `docs/billing.md`).
- `docs/analytics.md` - add `checkout_started`, `billing_portal_opened`, `subscription_started`, `subscription_ended`, the `limit` reason and the `branded` property.
- `docs/PRD.md` - add decision D14 (plans, limit, branding, billing off without keys), and remove "billing" from the out-of-scope line (`:50`).
- `CLAUDE.md` - one bullet: billing goes through `apps/web/src/lib/billing/`, the plan is read from `billing_customers`, never from Stripe at request time, and nothing is limited when Stripe keys are unset.

Work outside the repo: run `stripe-bootstrap.mjs --apply` in the King's Cross Labs sandbox (product and price already exist there; it adds the portal configuration) and later in live mode; create the webhook endpoint for the events above and set `STRIPE_WEBHOOK_SECRET`; create a LedaChat-only restricted key in each environment; add both as sensitive variables on the web app's Vercel project; add tax registrations once the accountant confirms where.

## Verification

    yarn test
    yarn workspace @adeli-chat/web lint
    yarn workspace @adeli-chat/web typecheck
    yarn workspace @adeli-chat/landing-page typecheck

Tests (fake `fetch`, in-memory PGlite):

- `apps/web/src/lib/billing/config.test.ts` - **new.** Billing is off unless both variables are set; a `pk_` key is rejected.
- `apps/web/src/lib/billing/webhook.test.ts` - **new.** A bad signature is `400`; a redelivered event is skipped; a handling failure releases the claim and returns `500`; an out-of-order `subscription.updated` for an older subscription doesn't overwrite an active one; a second active subscription is cancelled with `invoice_now: false`; `deleted` makes the plan Free; reconcile repairs a missed webhook once and is throttled.
- `apps/web/src/lib/billing/checkout.test.ts` - **new.** An existing subscription (in the row, or only in Stripe) gets the portal, not Checkout; open sessions are expired first; the customer carries `ledachat_user_id`.
- `apps/web/src/lib/automations/limit.test.ts` - **new.** With billing on, Free: the 10th goes live and the 11th returns `reason: "limit"`; saving an already-live automation at 10 still works; drafts and duplicates are unlimited; Pro and billing-off are unlimited; two concurrent `goLive` calls at 9 let exactly one through; another user's automations don't count.
- `apps/web/src/lib/runtime/handle.test.ts` - extend. A Free user's final DM carries the line; Pro's and billing-off's don't; an over-length legacy DM is sent unchanged, followed by the line as its own message; opening DMs are never branded.
- `apps/web/src/lib/mcp/mcp.test.ts` - extend. `go_live` at the limit returns the limit message and `upgrade_url`; `get_workspace` reports the plan.

Manual, against a Stripe sandbox and a local Adeli dev server (`docs/local-development.md`):

1. With no Stripe variables, confirm the Plan card is absent, 11 automations go live, and the final DM has no branding.
2. Set sandbox keys, run `stripe listen --forward-to localhost:3030/api/stripe/webhook`, and use its signing secret.
3. As a new user, put 10 automations live; the 11th is refused in the app and through MCP (Claude) with the upgrade message. Trigger one and see the branded final DM on a test Instagram account.
4. Upgrade with card `4242 4242 4242 4242`. The card shows Pro; the 11th goes live; the next final DM is unbranded.
5. Click Upgrade again in another tab: it opens the portal, not a second Checkout.
6. Cancel in the portal: the card says "Ends on <date>". Advance the sandbox's test clock past the period end: the plan is Free, all 11 stay live (agreed: nothing is paused), a 12th is refused, and the final DM is branded again.
7. Stop `stripe listen`, subscribe as another user, reload Settings: reconcile mirrors it and logs the missed webhook.

## Sequencing

0.1, 0.2, 0.3 first and together (one PR). Then 1.1 and 1.2 (one PR); billing can be turned on in production after this, and nobody is limited yet. Then 2.1 and 2.2 (one PR), which is the change existing hosted users notice. Milestone 3 can land with Milestone 0 and 1 (the sign-up and go-live alerts need no Stripe at all, so they can even go first). Milestone 4's docs ride with each PR; the landing page change lands with Milestone 2. Only the branding copy is still open, and it blocks only 2.2. The small Adeli change (quiet skip of LedaChat customers in its webhook) should land before LedaChat's first live subscription.

## Non-goals

- Annual billing, trials, coupons and promotion codes. Stripe Checkout can add promotion codes with one flag later.
- Teams, seats or more than one Instagram account per user. One user, one account, one subscription.
- Usage-based pricing of any kind. The site's point is "one flat price" (`landing-page.tsx:246`).
- Billing for self-hosted installs, or a licence check. Self-host is MIT and unlimited.
- An in-app invoice list or card form. The Customer Portal does both.
- Charging for Adeli usage. The hosted install's Adeli bill is LedaChat's cost, not the user's.

## Risks

- **Existing hosted users with more than 10 live automations** are refused new ones the day Milestone 2 ships, and their final DMs gain branding without warning. Count them first; consider an in-app notice a week ahead, or grandfathering the first users from the waitlist with a 100% coupon on Pro.
- **Branding inside someone else's DM** is the most visible thing LedaChat does. If a commenter complains to the creator, the creator blames us. Keep it one plain line, never a button, and never in the opening DM.
- **A missed webhook leaves a payer on Free.** Reconcile on Settings load is the repair, but a payer who never opens Settings stays limited. If that shows up, also reconcile inside `goLive` when it is about to refuse (one Stripe call, only at the limit).
- **Stripe outage.** Nothing at request time calls Stripe except Checkout and the portal, so automations keep running and limits keep using the last mirrored state.
- **The `2026-10-28.endive` pin** must exist in the installed `stripe` package. If the package doesn't support it, pin to the version the package ships with and note it here.
