# One server key, one Adeli profile per user

Branch: `env-api-key-and-profiles`

## Goal

1. Adeli Chat reads its Adeli API key only from `ADELI_API_KEY` (and the URL from `ADELI_API_BASE_URL`). Nobody enters a key in the app. "How to get a key" moves from the Setup page to `README.md`.
2. Every Adeli Chat user gets their own Adeli profile in the install's one Adeli organization, created with `client.profiles.createProfile` (`@adeli/sdk`) when they sign up.
3. `/connect` becomes a Connect button that starts Instagram Login for that user's profile through `client.profiles.startConnection`, then polls `getConnection` as today.
4. Everything after that is unchanged: automations, posts, webhooks and runs keep using `adeliCall(userId, ...)` and the user's stored profile id.

## Key decisions

- **Isolation now lives in Adeli Chat, not in the key.** Every user shares one org key, so the key can reach every user's profile. Server code must never take a `profileId` or `accountId` from the browser on trust:
  - `listInstagramAccounts(userId)` lists only the user's own profile, not `listProfiles()`.
  - `/api/adeli/connect/start` and `/status` drop the `profileId` parameter and use the stored one.
  - `/api/adeli/media` and `findMedia` check that `accountId` is in the user's profile (or just use `getConnectedAccount(userId)`).
  - `connectAccount` already checks via `listInstagramAccounts`, so it becomes safe once that is scoped.
- **Profile creation is idempotent.** `ensureUserProfile(userId)`:
  1. Returns `user_settings.adeli_profile_id` if set.
  2. Else looks for an Adeli profile with `externalId === userId` (`listProfiles`), in case the DB was reset.
  3. Else `createProfile({ body: { name, externalId: userId, metadata: { app: "adeli-chat" } } }, { idempotencyKey: "adeli-chat-profile-<userId>" })`.
  4. Stores id and name in `user_settings`.
- **When it runs.** A Better Auth `databaseHooks.user.create.after` hook calls it on sign-up (errors logged, not thrown, so sign-in never fails because Adeli is down). `/connect`, `ensureAdeliWebhook` and the `(app)` layout also call it lazily, which covers the no-login `local` user, users who signed up before this change, and a failed hook.
- **Profile name.** The user's Google name, falling back to their email, e.g. `Ada Lovelace (ada@example.com)`. For `local`: `Local`. (See open question 1.)
- **Missing or rejected server key** is an operator problem, not a user one. The banner says "This Adeli Chat server's Adeli key is missing or rejected. Ask whoever runs it to set `ADELI_API_KEY`." No link to a key form.

## Changes by file

### Key and client
- `src/lib/adeli/key.ts`: `getAdeliConfig()` reads only `ADELI_API_KEY` and `ADELI_API_BASE_URL` (for every user, not just `local`). Drop `KeySource`, `getUserSettings`, `openSecret`. Keep `normalizeBaseURL`, `findAdeliConfig`. Signature can keep `userId` or drop it; `adeliCall(userId, ...)` keeps its signature so call sites don't change.
- `src/lib/adeli/client.ts`: remove the `candidate` key path and the per-user `markKeyStatus(userId, "invalid")`. Optionally keep one server-wide "last 401" flag in memory for the banner. Update the 401 message ("The server's Adeli API key was rejected.").
- `src/lib/adeli/instagram.ts`: add `ensureUserProfile` (or put it in a new `src/lib/adeli/profile.ts`), scope `listInstagramAccounts`, `startConnect`, `getConnectSession` to the user's profile, add the `accountId` ownership check for media.
- `src/lib/adeli/browser.ts`: `startConnect()` and `getConnectSession(sessionId)` without `profileId`.

### Auth
- `src/lib/auth/server.ts`: add `databaseHooks.user.create.after` calling `ensureUserProfile(user.id)`.

### Data
- `src/lib/db/schema.ts` + migration `drizzle/0008_server_adeli_key.sql` (via `npm run db:generate`): drop `adeli_api_key_encrypted`, `adeli_base_url`, `adeli_key_status`, `adeli_key_checked_at` from `user_settings`. Keep `adeli_profile_id`, `adeli_profile_name`, webhook columns.
- Existing rows: their stored profile belongs to whatever org their old key was in, which the server key probably can't reach. The migration clears `adeli_profile_id`, `adeli_profile_name`, `adeli_webhook_id`, `adeli_webhook_secret`, marks `accounts` disconnected and pauses live automations. On next visit they get a new profile and reconnect Instagram; `connectAccount` matches the same `ig_user_id`, so their automations, runs and leads follow the account. (See open question 2.)
- `src/lib/user-settings.ts`: remove `markKeyStatus`, `saveAdeliConnection`; add `saveProfile(userId, { id, name })`.

### Webhooks
- `src/lib/runtime/webhook-registration.ts`: use `ensureUserProfile(userId)` instead of `listProfiles()[0]`. Called after a profile is created and after a successful Instagram connect (instead of after "key saved"). Boot registration in `instrumentation.ts` stays.

### Actions
- `src/lib/actions.ts`: delete `KeyState`, `lastKeyState`, `checkAdeliKey`, `saveAdeliConnection`, `testConnection`. Add a small `adeliStatus()` for Settings (server key configured, base URL, profile name). After `connectAccount`, call `ensureAdeliWebhook`.

### Pages and components
- Delete `src/app/setup/page.tsx`, `src/components/adeli/connection-form.tsx`, `src/components/onboarding/get-key-instructions.tsx`. Redirect `/setup` to `/connect` (in `next.config.ts`) so old links work. Move the sign-out "Signed in as" block to `/connect`.
- `src/components/onboarding/onboarding-layout.tsx`: two steps, "Instagram account" and "First automation".
- `src/app/connect/page.tsx`: ensures the profile, no key redirect. Shows a server-misconfigured card if `ADELI_API_KEY` is unset.
- `src/components/onboarding/connect-card.tsx`: lead with one **Connect Instagram** button. On `connected`, call `connectAccount` and go to `/automations`. If the user's profile already has accounts (reconnect, or a second account), still list them so they can pick one.
- `src/components/settings/settings-view.tsx`: replace the key card with a read-only Adeli card (profile name, Adeli URL, "set by the server"). Instagram card unchanged.
- `src/components/shell/key-banner.tsx` and `(app)/layout.tsx`: operator-facing message, driven by `findAdeliConfig()` and the server-wide 401 flag.
- `src/proxy.ts` comment and `src/lib/mcp/server.ts` instructions/`get_workspace` (`adeliKey` field) updated.

### Docs and config
- `README.md`: "Get your Adeli API key" becomes the place for the key steps (create Adeli account, API keys page, copy `rk_live_` key, set `ADELI_API_KEY` locally and on Vercel). Env table gains `ADELI_API_KEY` (required) and `ADELI_API_BASE_URL` (optional). Remove "paste your key on Setup" and per-user key wording; explain one org, one profile per user.
- `.env.example`, `docs/local-development.md`, `docs/PRD.md` (§0 new decision superseding the in-app key, §5.11 adds `createProfile`), `CLAUDE.md` (Adeli API key bullet and "every user has their own workspace" bullet).

### Tests
- `src/lib/adeli/client.test.ts`: env-only config for any user, no Settings key.
- New `src/lib/adeli/profile.test.ts`: creates once, reuses stored id, finds by `externalId`, sends the idempotency key.
- Scoping tests: `listInstagramAccounts` only queries the user's profile; media for an account outside the profile is refused.
- `test/db-helpers.ts`, `webhook-registration.test.ts`, `mcp.test.ts`: drop sealed keys, stub `ADELI_API_KEY`.
- `npm run typecheck && npm run lint && npm test`, then a manual run against the local Adeli dev server: sign in as two Google users, confirm two profiles in Adeli, connect Instagram for one, check the other can't see it.

## Decisions on the open questions (2026-11-10)

1. **Profile name:** the user's Google name and email, `Name (email)`. `externalId` is the user id.
2. **Existing users:** reset. The migration clears their profile and webhook, marks their Instagram account disconnected and pauses live automations. When they connect the same Instagram account again, `connectAccount` finds their old `accounts` row by `ig_user_id` and reuses it, so automations, runs and leads come back (paused; they click Go live again).
3. **Deleting users:** no Adeli profile cleanup.
