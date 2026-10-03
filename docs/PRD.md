# Adeli Chat: PRD + Build Plan v0.3 (Instagram Comment to DM)

> Status: **Approved for build. UI milestones unblocked; runtime blocked on Adeli API additions (§12A)** · Owner: @kingscrosslabs · Last updated: 2026-10-02
>
> Companion docs: [`docs/brand.md`](brand.md) (design system and copy voice).

An open-source, self-hostable ManyChat alternative built on the Adeli API. v1 does one thing well: **when someone comments on your Instagram post, reply to their comment and send them a DM with a link.**

**Style rule for all copy in this repo (UI text, defaults, docs): no em dashes.**

---

## 0. Decisions log

| # | Question | Decision |
|---|---|---|
| D1 | Stack | Next.js (App Router) + TypeScript + Postgres (Drizzle ORM) + pg-boss job queue (runs inside Postgres, no Redis). |
| D2 | Who logs in | Single owner per install. Password in `ADMIN_PASSWORD` env var, signed session cookie. |
| D3 | Repeat commenters | A person gets the DM flow **once per automation**. Later comments from them are ignored by that automation. |
| D4 | Editing a Live automation | **Save applies immediately** (after validation passes). |
| D5 | Any comment | Yes. Trigger can be **Specific keywords** or **Any comment**. |
| D6 | Stats | Basic counts only in v1. Link-click tracking is v1.1. |
| D7 | Defaults | Name `Comment to DM #n`. Replies listed in FR-5.10. No em dashes. |
| D8 | Instagram access | Every Instagram call goes through **the Adeli public API v1** (`https://app.tryadeli.com/api/v1`), wrapped in our own typed client in `src/lib/adeli/`. Endpoint map in §5.11. |
| D9 | Design | Adeli **dashboard** design system, copied directly (Tailwind v4 tokens + shadcn `base-nova` on Base UI). Full reference in [`docs/brand.md`](brand.md). Light mode only in v1. |
| D10 | Adeli API key | **Bring your own key** (confirmed by Mika, 2026-10-02). Each install uses its owner's Adeli key. Entered in a first-run **Setup** screen, validated live, stored encrypted in Postgres. `ADELI_API_KEY` in env overrides the UI and locks the field (for Docker/PaaS deploys and for our own hosted instance). Our KCL key never ships in the repo. |
| D11 | Connecting Instagram | Two paths on `/connect`: (1) **pick an account already connected in Adeli** (default, no OAuth on our side), or (2) **connect a new one** through Adeli's connect session in poll mode (no redirect allowlist needed). |
| D12 | Adeli API gaps | Missing Comment-to-DM primitives (§12A) are built **in the Adeli repo**, as a separate plan there. Adeli Chat codes against its channel interface + mock until they ship. |

---

## 1. Goals and non-goals

### Goals (v1)
1. Guide a new install from zero to working: get an Adeli API key, paste it in, connect an Instagram Professional (Business/Creator) account through the **Adeli API**.
2. Create, edit, save, go live with, and pause **Comment to DM** automations.
3. A ManyChat-style **split editor**: settings on the left, live phone preview on the right.
4. Reliable runtime: every matching commenter gets exactly one DM flow per automation. No duplicates, nothing lost on retries.
5. Easy to self-host and easy to contribute to.

### Non-goals (v1). Shown in the UI as "Coming soon" where relevant.
- Other triggers: Direct Message, Story Reply, Story Mention.
- Other channels: Facebook, TikTok.
- Other DM types: Image, Video, Card.
- Post targeting other than one specific post ("Any post", "Next post").
- Follow-gating, email/phone collection, tags, broadcasts, AI replies.
- Visual node-based flow builder.
- Link-click tracking, multi-user accounts, billing.

---

## 2. How Instagram Comment to DM works (constraints that shape the UX)

Think of Instagram DMs as a shop with a locked door. A comment lets you slip **one note** under the door (a "private reply"). You can't walk in until the customer opens the door by tapping a button or replying. That is why the **Opening DM** with a button is required: the tap opens a 24-hour messaging window, and only then can the **Final DM** with the link be sent.

| Meta rule | Effect on the product |
|---|---|
| One private reply per comment, within 7 days of the comment. | Opening DM is a single message, sent fast, never retried after a success. |
| More DMs need the person to interact first, which opens a 24h window. | Final DM is sent when they tap the Opening DM button. |
| Button message text max 640 chars, max 3 buttons, button title max 20 chars. | Field validation plus character counters. |
| Account must be Instagram Professional with messaging and comment permissions. | Connect flow shows clear errors for personal accounts or missing permissions. |
| Rate limits on automated replies and DMs. | Queue with backoff. Show "delayed", never silently drop. |

> These are Meta's platform rules. Adeli's API does not abstract them today: it returns `409 window_closed` when a DM is sent outside the 24h window, and has no private-reply endpoint yet (§12A).

### Where the Adeli API key fits

Think of the Adeli key as the **key to a mailroom**. Adeli holds the actual Instagram credentials (the provider tokens) and does the sending. Adeli Chat never sees an Instagram token. It only holds one Adeli key, and that key is bound to exactly one Adeli **profile** (Adeli's word for a workspace), which owns the connected Instagram accounts.

```
Adeli Chat install ──(Bearer rk_live_… key)──▶ Adeli profile ──▶ connected Instagram account(s)
```

Consequences:
- Whoever owns the key owns what the install can do. A clone of this repo must bring **its own** Adeli account and key. Sharing our key would let strangers post and DM as our connected accounts.
- One install = one Adeli profile. Multi-account later means picking among that profile's Instagram accounts, not juggling keys.

---

## 3. User stories

**Persona:** a creator or small-business marketer who posts "Comment **GUIDE** and I'll DM you the link."

| # | Story | Acceptance |
|---|---|---|
| U1 | I log in to my install. | Password screen. Wrong password shows an error. Session lasts 30 days. |
| U1a | On first run I'm told I need an Adeli API key, and shown exactly how to get one. | Setup screen with numbered steps and deep links to Adeli. Pasting a key validates it live and shows which Adeli profile it belongs to. |
| U2 | I connect my Instagram account. | I can pick an account already connected in Adeli, or connect a new one without leaving the flow. After connecting I see my handle and avatar, and my posts load in the editor. |
| U3 | I click **Create automation** and pick a template. | Modal shows "Comment to DM" (enabled) and 3 "Coming soon" options (disabled). |
| U4 | I pick the post people will comment on. | Grid of my posts, reels and carousels. Videos preview on hover. Exactly one must be selected. |
| U5 | I choose specific keywords or any comment. | Keywords become chips. Matching is case-insensitive "contains". |
| U6 | I write public comment replies. | 3 variants pre-filled. One is picked at random per comment. |
| U7 | I customise the Opening DM and its button. | Defaults pre-filled. Required. |
| U8 | I customise the Final DM text and link button. | Defaults pre-filled. URL validated. |
| U9 | I see a live preview of Post, Comments and DM while editing. | The phone mock updates as I type and switches tab to the section I'm editing. |
| U10 | I save, go live, and pause. | Status pill and buttons change as in §5.9. |
| U11 | I see my automations with status and counts. | Name, post thumbnail, trigger, status, counts. |

---

## 4. Screens and routes

```
/login                  Password screen
/                       Redirect: /setup if no Adeli key, else /connect if no Instagram account, else /automations
/setup                  Adeli API key: instructions, paste, validate (first run, and from Settings)
/connect                Connect Instagram (pick from Adeli, or connect new via Adeli)
/automations            List + "Create automation" button
  (modal)               Template picker
/automations/[id]       Split-screen editor
/settings               Adeli key (masked, replace, remove), connected account, reconnect, disconnect, log out
/api/webhooks/adeli     Incoming events from Adeli (comments, button taps), once Adeli ships them (§12A)
```

Onboarding is a three-step checklist shown on `/setup` and `/connect`: **1. Adeli key · 2. Instagram account · 3. First automation.** Each step shows done / current / next, so a new user always knows where they are.

---

## 5. Functional requirements

### 5.0 Login
- **FR-0.1** All pages except `/login` and `/api/webhooks/*` require a session.
- **FR-0.2** `/login` compares input to `ADMIN_PASSWORD` (constant-time). On success, set an HTTP-only signed cookie (`SESSION_SECRET`), 30-day expiry.
- **FR-0.3** Simple rate limit: 5 failed attempts per IP per 15 min.
- **FR-0.4** Log out clears the cookie.

### 5.0b Setup: Adeli API key
- **FR-S.1** Key source, in priority order: (1) `ADELI_API_KEY` env var, (2) key saved through the UI (encrypted in `app_settings`). If neither exists, every app page except `/setup`, `/settings` and `/login` redirects to `/setup`.
- **FR-S.2** `/setup` layout: Adeli Chat wordmark, the 3-step checklist, then a card titled **"Connect your Adeli account"** with:
  - One line of why: "Adeli Chat sends comments and DMs through Adeli, so it needs an API key from your Adeli account. It's free to create one."
  - Numbered instructions, each with a deep link that opens in a new tab:
    1. **Create an Adeli account.** Go to [app.tryadeli.com/sign-in](https://app.tryadeli.com/sign-in) and sign in with Google. Your first sign-in creates your account and a default profile.
    2. **(Optional) Connect Instagram in Adeli.** Open **Connections** and connect your Instagram Business or Creator account. You can also do this from Adeli Chat in the next step.
    3. **Create an API key.** Open [API keys](https://app.tryadeli.com/settings/api-keys), label it "Adeli Chat", and click **Create key**.
    4. **Copy the key now.** Adeli shows it only once. It starts with `rk_live_`.
  - A password-type input (Geist Mono) labelled "Adeli API key", placeholder `rk_live_…`, with a show/hide toggle, and a **Save and continue** button.
  - A collapsible "Is this safe?" note: "Your key stays on this server. It's encrypted in your database and never sent to your browser after you save it. You can delete it in Adeli at any time to revoke access instantly."
- **FR-S.3** Validation on save: client-side format check (`rk_live_` + 43 URL-safe chars), then the server calls `GET /api/v1/profiles` with the key.
  - `200`: save it, show "Connected to Adeli profile **{name}**" with a check, and continue to `/connect`.
  - `401`: "Adeli didn't accept that key. Check you copied all of it, or create a new one." Nothing is saved.
  - Network error or `5xx`: "We couldn't reach Adeli. Try again in a minute." Nothing is saved.
- **FR-S.4** Storage: AES-256-GCM, key derived with HKDF from `SESSION_SECRET`. Store ciphertext, the display prefix (first 12 chars, e.g. `rk_live_Ab3d…`, matching how Adeli lists keys), and the profile id and name returned by Adeli. The plaintext key is never returned to the browser, logged, or put in a URL. Changing `SESSION_SECRET` means re-entering the key (the Setup screen explains this if decryption fails).
- **FR-S.5** Env-managed mode: if `ADELI_API_KEY` is set, `/setup` and Settings show "Managed by your server environment (`ADELI_API_KEY`)" with the masked prefix and profile name, and hide the input. Validation still runs once at boot and surfaces a banner if the key is rejected.
- **FR-S.6** Settings > Adeli: masked prefix, profile name, "Last checked" time, **Test connection**, **Replace key**, **Remove key** (confirm dialog; removing pauses all Live automations, same as Disconnect).
- **FR-S.7** Key revoked later (any Adeli call returns `401`): mark the key `invalid`, pause runtime sending (jobs wait, nothing is dropped), and show a global banner: "Your Adeli key stopped working. Add a new one to resume your automations." linking to `/setup`.
- **FR-S.8** Profile mismatch guard: if a replacement key belongs to a **different** Adeli profile than the stored one, warn before saving: "This key belongs to a different Adeli profile ({name}). Your connected Instagram account and Live automations will be paused." Confirm or cancel.
- **FR-S.9** Mock mode (`ADELI_MOCK=1`): Setup accepts any value (or a "Skip, use demo data" button) so contributors never need a real key.

### 5.1 Connect Instagram (via Adeli)
- **FR-1.1** `/connect` first calls `GET /api/v1/accounts?platform=instagram`. If the key's profile already has Instagram accounts, show them as selectable cards (handle, display name, connection status). Choosing one stores it. This is the default path and needs no OAuth on our side.
- **FR-1.2** **Connect a new account** (shown always, primary if the list is empty): our backend calls `POST /api/v1/profiles/{profileId}/connect` with `{ "platform": "instagram" }` and **no `redirectUrl`** (poll mode, so self-hosted installs on any domain work without Adeli allowlisting their origin). The UI opens the returned `authUrl` in a new tab and polls `GET /api/v1/profiles/{profileId}/connect/{sessionId}` every 2s, showing "Waiting for Instagram…" with a Cancel link. Sessions expire after 10 minutes.
- **FR-1.3** Login method: default `authMethod: "instagram_login"`. Offer "Use Facebook login instead" as a secondary link (`facebook_login`) for accounts managed through a Facebook Page.
- **FR-1.4** On `connected`, store the Adeli `accountId`, `providerId` (IG user id), `displayName`, `displayIdentifier` (handle) and status. We never store Instagram tokens (Adeli holds them).
- **FR-1.5** Errors: session `failed` or `expired`, user closed the tab, `403 missing_permission` on later calls (needs reconnect with comment + messaging permissions), personal account, Adeli unavailable. Each has a plain-language message and a retry button.
- **FR-1.6** Settings: show account, **Reconnect** (re-runs FR-1.2; Adeli keeps the same `accountId`), **Disconnect** (removes it from Adeli Chat only and pauses all Live automations; we do not call Adeli's delete, since the account may be used by other Adeli apps. A link explains how to fully remove it in Adeli).
- **FR-1.7** One connected Instagram account per install in v1. The data model allows more.

### 5.2 Automations list
- **FR-2.1** Columns: name, post thumbnail, trigger summary ("GUIDE, LINK" or "Any comment"), status pill, Triggered, Final DMs sent, last updated.
- **FR-2.2** Row actions: Edit, Pause/Go Live, Duplicate, Delete (confirm dialog; deleting a Live automation pauses it first).
- **FR-2.3** Empty state with a "Create automation" button.

### 5.3 Create automation modal
- **FR-3.1** Title "Create automation". Four cards:
  - **Comment to DM**: "Send a DM when someone comments a keyword on your post". Enabled.
  - **Direct Message**: "Reply instantly when someone DMs you on autopilot". Coming soon.
  - **Story Reply**: "Send a follow-up DM when someone replies to your story". Coming soon.
  - **Story Mention**: "Reply automatically when someone mentions you in their story". Coming soon.
- **FR-3.2** Choosing Comment to DM creates a **Draft** with all defaults and opens the editor.
- **FR-3.3** If no Instagram account is connected, the modal asks you to connect first.

### 5.4 Editor layout
- **FR-4.1** At 1024px and wider: two columns. **Left** is the scrollable form (about 45%), **right** is the sticky phone preview (about 55%). Below 1024px: form full width plus a "Preview" button that opens the phone in a drawer.
- **FR-4.2** **Header bar:** back link, inline-editable name, status pill, save indicator ("Saved 2m ago" / "Unsaved changes"), **Save**, and **Go Live / Pause**.
- **FR-4.3** Warn before leaving with unsaved changes. Cmd/Ctrl+S saves.

### 5.5 Editor sections (left side, top to bottom)

**A. Automation name**
- **FR-5.1** Default `Comment to DM #<n>` where n = total automations created + 1. Required, max 80 chars.

**B. When someone comments on**
- **FR-5.2** "A specific post or reel" (selected). "Any post or reel" and "Next post or reel" shown as Coming soon.
- **FR-5.3** Grid of the account's media from our API (which calls Adeli): reels, videos, images, carousels. Each tile shows thumbnail, type icon, caption snippet, date. "Load more" pagination.
- **FR-5.4** Video and reel tiles play a muted preview on hover (or show a play icon if only a thumbnail exists).
- **FR-5.5** Exactly one post required to go live. The selected post is shown in the preview.
- **FR-5.6** Store a snapshot of the chosen post (thumbnail, type, caption, permalink) so the editor still renders if the post is later deleted. Show a warning if it no longer exists.

**C. And this comment has**
- **FR-5.7** Two options (radio):
  - **A specific keyword** (default): chip input.
  - **Any comment**: every comment on the post triggers it.
- **FR-5.8** Chip input: Enter, comma or Tab turns the text into a chip. × removes. Backspace on empty input removes the last chip. Duplicates (case-insensitive) blocked.
- **FR-5.9** Matching: lowercase, trimmed, **contains**. Keyword `guide` matches "Can I get the GUIDE pls". Emoji keywords allowed.
- **FR-5.10** With "A specific keyword", at least 1 keyword is required to go live. Max 20 keywords, max 50 chars each.
- **FR-5.11** Helper text: "Matches comments that contain any of these words. Not case-sensitive."
- Default keyword for new automations: none (placeholder text "e.g. GUIDE"). The preview uses "GUIDE" when empty.

**D. Reply to their comment**
- **FR-5.12** Toggle, default **on**. When on, a list of reply variants. Defaults:
  1. "Sent you a DM! 📩"
  2. "Check your DMs 👀"
  3. "Just sent it over, check your inbox ✨"
- **FR-5.13** "+ Add reply" (max 10). Each row deletable. When on, at least 1 non-empty reply is required. Helper text: "Write 3 or more. We'll send them in a random order so replies look natural."
- **FR-5.14** One variant is picked at random for each matched comment. Max 300 chars each.

**E. Opening DM (required)**
- **FR-5.15** Message, default "Hey there! Click below and I'll send you the link in a second." Max 640 chars with a counter.
- **FR-5.16** Button label, default "Yes please". Max 20 chars. Required.
- **FR-5.17** Info tooltip: "Instagram only lets you send one message until the person taps. This button opens the conversation so we can send your link."

**F. Final DM**
- **FR-5.18** DM type selector: **Text + Buttons** (selected). Image, Video, Card shown disabled with "Coming soon".
- **FR-5.19** Message, default "Here it is! Enjoy!". Max 640 chars.
- **FR-5.20** Button #1: label default "Click for link!" (max 20 chars), URL default `https://tryadeli.com` (must be a valid `https://` URL).
- **FR-5.21** The data model supports up to 3 buttons. The v1 UI shows 1.

### 5.6 Phone preview (right side)
- **FR-6.1** iPhone-style frame using Instagram's general visual language. No Meta logos or copied assets.
- **FR-6.2** Segmented tabs: **Post · Comments · DM**.
  - **Post:** selected media (or a placeholder), handle and avatar, caption snippet.
  - **Comments:** a sample commenter writes the first keyword (or "Love this!" for Any comment), with your reply (first variant) underneath.
  - **DM:** Opening DM bubble with its button, then the person's tap (the button label as their bubble), then the Final DM bubble with its link button.
- **FR-6.3** Updates on every keystroke. Focusing a section switches tabs: B to Post, C and D to Comments, E and F to DM.

### 5.7 Validation
- **FR-7.1** Saving a **Draft** or **Paused** automation is always allowed, even if incomplete.
- **FR-7.2** **Go Live** and **Save while Live** run full validation. Failing fields are highlighted, the form scrolls to the first error, and a toast says e.g. "2 things to fix before going live". Save while Live with errors is rejected and nothing changes on the live version.
- **FR-7.3** Conflict rule at Go Live: two Live automations on the same post may not overlap. Overlap means a shared keyword (case-insensitive), or either one uses Any comment. The error links to the other automation.

### 5.8 Runtime (backend)
- **FR-8.1** Event intake has two interchangeable sources behind `channel.watchComments()`:
  - **Target: webhook.** Adeli posts comment and button-tap events to `/api/webhooks/adeli`. Verify the signature. Respond 200 within 1s and queue the work. Needs §12A items A1 and A4.
  - **Interim: polling.** A pg-boss cron job calls `GET /api/v1/comments?platform=instagram&accountId=…&postId=…` for each post with a Live automation every 60s, and treats comment ids it hasn't seen as new events. Works with today's API; slower (up to 60s) and costs one Adeli call per live post per minute.
- **FR-8.2** Ignore: comments by the connected account itself, replies inside comment threads that we posted, comments on posts with no Live automation.
- **FR-8.3** On a match (keyword contained, or Any comment), if this person has **not** already had a run on this automation (D3), create a run and queue:
  1. If enabled, reply publicly to the comment with a random variant.
  2. Send the **Opening DM** as a private reply to the comment, with a button whose payload carries the run id.
- **FR-8.4** On the button tap event: look up the run by payload and send the **Final DM** (text + URL button). A second tap does not resend.
- **FR-8.5** Repeat commenters are skipped for that automation. They are counted as "Skipped (repeat)" in logs, not in public stats.
- **FR-8.6** Dedupe on Adeli/Meta event id. Processing is at-least-once with dedupe so nothing is sent twice.
- **FR-8.7** Retry transient errors and rate limits with exponential backoff (max 5 tries). Never retry a private reply that succeeded. Record permanent failures with a reason.
- **FR-8.8** Pausing stops new runs immediately. Runs already waiting on a button tap still get their Final DM.
- **FR-8.9** Because Save applies immediately (D4), runs always use the automation's **current** content at the moment each message is sent.
- **FR-8.10** If the person types a reply instead of tapping the button, v1 does nothing. (v1.1: treat any reply as a tap.)

### 5.9 Status and buttons
| Status | Pill | Primary button | Secondary |
|---|---|---|---|
| Draft (never live) | grey "Draft" | **Go Live** | Save |
| Live | green "Live" with a pulsing dot | **Pause** | Save (applies immediately) |
| Paused | amber "Paused" | **Go Live** | Save |

- **FR-9.1** Go Live = save + validate + activate in one click.
- **FR-9.2** Pause takes effect immediately and needs no validation.

### 5.10 Stats (basic)
- **FR-10.1** Per automation: **Triggered** (new runs), **Comment replies sent**, **Opening DMs sent**, **Button taps**, **Final DMs sent**. Shown on the list page and in the editor header (small stat row).
- **FR-10.2** Counts come from the runs table. No charts in v1.

### 5.11 Adeli API map (verified against the Adeli repo, 2026-10-02)

Base URL `https://app.tryadeli.com/api/v1`, header `Authorization: Bearer rk_live_…`. Errors use `{ "error": { "code", "message", "details" } }`. Aggregate reads may return `207` `partial`.

| Adeli Chat needs | Adeli endpoint | Status |
|---|---|---|
| Validate key, get profile | `GET /profiles` | ✅ Available |
| List connected IG accounts | `GET /accounts?platform=instagram` | ✅ Available |
| Connect a new IG account | `POST /profiles/{id}/connect`, poll `GET /profiles/{id}/connect/{sessionId}` | ✅ Available (poll mode, no `redirectUrl`) |
| List posts for the picker | `GET /posts?platform=instagram&accountId=` | ✅ Available, but unpaginated (Adeli follows cursors server-side, up to 10k). Fine for v1; we paginate client-side. |
| Read comments on a post | `GET /comments?platform=instagram&accountId=&postId=` | ✅ Available (used by interim polling). Comment shape has `authorHandle` but **no commenter IG user id**. |
| Reply publicly to a comment | `POST /comments` with `parentId` | ✅ Available |
| Detect new comments in real time | Outbound webhook to client | ❌ Missing (A1) |
| Opening DM as a private reply to a comment | `POST /messages` with `recipient: { commentId }` | ❌ Missing (A2) |
| DM with a button (postback or URL) | `POST /messages` with buttons | ❌ Missing (A3). Today `POST /messages` is text only. |
| Button tap events | Outbound webhook (postback) | ❌ Missing (A4) |
| Final DM inside the 24h window | `POST /messages` (text) | ✅ Available as text only. With A3, text + URL button. Returns `409 window_closed` outside the window. |
| Rate limiting | `429 rate_limited` on comments | ⚠️ Partial. Rate limiting is otherwise out of scope in Adeli v1, so our queue must self-throttle. |

---

## 6. Data model

```
app_settings                                -- single row (id = 1)
  adeli_api_key_ciphertext, adeli_api_key_iv, adeli_api_key_prefix,
  adeli_profile_id, adeli_profile_name,
  adeli_key_status ('valid' | 'invalid' | 'unchecked'), adeli_key_checked_at,
  updated_at

accounts
  id, provider ('instagram'), adeli_profile_id, adeli_account_id, ig_user_id (Adeli providerId),
  handle, display_name, avatar_url,
  status ('connected' | 'needs_reconnect' | 'disconnected'), created_at, updated_at

automations
  id, account_id, name, type ('comment_to_dm'),
  status ('draft' | 'live' | 'paused'),
  trigger        jsonb  { postScope: 'specific', mediaId, mediaSnapshot{thumbUrl,mediaType,caption,permalink},
                          match: 'keywords' | 'any', keywords: string[] }
  comment_reply  jsonb  { enabled: boolean, variants: string[] }
  opening_dm     jsonb  { text, buttonLabel }
  final_dm       jsonb  { type: 'text_buttons', text, buttons: [{ label, url }] }
  created_at, updated_at, live_at

runs
  id, automation_id, ig_user_id, ig_username, comment_id, comment_text,
  state ('matched' | 'opening_sent' | 'tapped' | 'final_sent' | 'failed'),
  comment_reply_state ('skipped' | 'sent' | 'failed'),
  error, created_at, updated_at
  UNIQUE (automation_id, ig_user_id)        -- enforces D3

webhook_events
  id (provider event id, PK), type, received_at, processed_at, payload jsonb
```

`runs.ig_user_id` is the commenter's Instagram-scoped id once Adeli exposes it (A1/A5). Until then the interim poller fills it with `handle:<authorHandle>`, which still enforces D3 per handle.

Trigger and message configs are JSON so new triggers, DM types and channels don't need column-by-column migrations. Each JSON shape has a Zod schema shared by the UI, API and worker.

---

## 7. Architecture

```
Instagram ──comment──▶ Adeli ──webhook──▶ /api/webhooks/adeli ──▶ pg-boss queue ──▶ worker
                                                                       │
          ◀──── comment reply / private reply / DM via Adeli API ──────┘
```

- **App:** Next.js 16 App Router + TypeScript (match Adeli's version). Server Actions for editor saves, route handlers for webhooks and auth. Next 16 uses `proxy.ts` for the auth guard, not `middleware.ts`.
- **UI:** Tailwind CSS v4 (CSS-first, no `tailwind.config.ts`) + shadcn `base-nova` style on Base UI, with Adeli's component files copied in. All tokens live in `src/app/globals.css`. See [`docs/brand.md`](brand.md).
- **Forms:** React Hook Form + Zod (same schemas on server).
- **DB:** Postgres + Drizzle ORM + drizzle-kit migrations.
- **Queue/worker:** pg-boss. Started from Next.js `instrumentation.ts` in the same Node process (simplest), with an option to run `npm run worker` separately.
- **Adeli client:** `src/lib/adeli/` typed client. Nothing else talks to Adeli directly. It gets its key from `getAdeliKey()` (`src/lib/adeli/key.ts`: env first, then decrypted `app_settings`), maps Adeli error codes (`unauthorized`, `missing_permission`, `window_closed`, `rate_limited`, `provider_error`) to typed errors, and marks the key `invalid` on any `401` (FR-S.7). Server-only (`import "server-only"`).
- **Channel adapter:** `src/lib/channels/types.ts` defines `listMedia`, `replyToComment`, `sendPrivateReply`, `sendMessage`, `parseWebhook`. `instagram.ts` implements it via the Adeli client. Facebook and TikTok add files here later.
- **Mock mode:** `ADELI_MOCK=1` swaps in a fake Adeli client with sample posts and a "Simulate comment" button, so anyone can run the UI without Instagram or an Adeli key.
- **Deploy target (v1):** one long-running container (Docker Compose locally, Railway/Render/Fly or a VPS in prod). Vercel isn't supported in v1 because of the background worker.

### Proposed folder structure
```
src/
  app/
    (auth)/login/page.tsx
    (onboarding)/setup/page.tsx
    (onboarding)/connect/page.tsx
    (app)/automations/page.tsx
    (app)/automations/[id]/page.tsx
    (app)/settings/page.tsx
    api/webhooks/adeli/route.ts
    api/setup/key/route.ts          POST validate + save, DELETE remove
    api/connect/start/route.ts      starts an Adeli connect session
    api/connect/status/route.ts     polls the session
    globals.css                     Adeli tokens (docs/brand.md §10)
  components/
    ui/                     copied from adeli/apps/web/components/ui
    onboarding/             checklist, key form, setup instructions, account picker
    automations/            list, create modal, status pill
    editor/                 sections A to F, header bar, chip input
    preview/                phone frame, post / comments / dm views
  lib/
    adeli/                  client.ts, mock.ts, types.ts, key.ts (resolve + encrypt/decrypt), errors.ts
    channels/               types.ts, instagram.ts
    db/                     schema.ts, index.ts
    automations/            schemas.ts (zod), defaults.ts, validate.ts, conflicts.ts
    runtime/                match.ts, worker.ts, jobs.ts, poll-comments.ts (interim intake)
    auth/                   session.ts
proxy.ts                    auth + setup guard (Next 16)
drizzle/                    migrations
docker-compose.yml
.env.example
```

### Environment variables
```
DATABASE_URL=
APP_URL=http://localhost:3000
ADMIN_PASSWORD=
SESSION_SECRET=                         # also derives the key that encrypts the saved Adeli key
ADELI_API_BASE_URL=https://app.tryadeli.com/api/v1
ADELI_API_KEY=                          # optional. Set it to skip the Setup screen (PaaS, Docker, our hosted instance)
ADELI_WEBHOOK_SECRET=                   # optional until Adeli ships outbound webhooks (A1)
ADELI_MOCK=0
```

**Our own key (KCL):** for our hosted instance and local dev, put the KCL key in `.env.local` / the host's secret store as `ADELI_API_KEY`. Never commit it. `.env*` stays gitignored, and CI runs with `ADELI_MOCK=1`.

---

## 8. Non-functional requirements
- **Speed:** comment to Opening DM in under 10s at p95 (excluding Meta delays).
- **Reliability:** never two DM flows for the same person on the same automation. Webhook handler answers within 1s.
- **Security:** webhook signature check, all app pages behind login, only store what's needed (IG user id, username, comment text). The Adeli key is env or encrypted-at-rest only, server-only, never sent to the browser after save, never logged (redact `rk_live_*` in the logger).
- **Accessibility:** keyboard-friendly editor, labelled inputs, WCAG AA contrast.
- **Responsive:** usable down to 375px wide.
- **Compliance:** README reminds users to follow Meta Platform Terms and Instagram messaging policies.

---

## 9. Open-source requirements
- MIT license (present). README with screenshots and a 5-minute quickstart, including a **"Get your Adeli API key"** section that mirrors the Setup screen steps (FR-S.2), and a note that the Adeli logo is used with permission (brand.md §9).
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and PR templates.
- `docs/architecture.md`, plus guides for "Adding a channel" and "Adding a trigger".
- CI (GitHub Actions): lint, typecheck, unit tests, build.
- Seed script and mock mode so contributors can run everything without Instagram.

---

## 10. Build plan

Each milestone ends in something you can click through. Check boxes as we go.

Two tracks run in parallel. **Track C** (this repo) can go all the way through M3 on the mock. **Track A** (the Adeli repo, §12A) has to land before M4 can go fully live.

```
Track C (adeli-chat):  M0 ─ M1 ─ M2 ─ M3 ─ M4a (polling + comment replies) ─ M4b (DMs) ─ M5 ─ M6
Track A (adeli):        A2 + A3 (private reply, buttons) ─ A1 + A4 (webhooks) ─ A5    ▲
                                                     └─────────── unblocks ──────────┘
```

### Frontend preview (built 2026-10-03, frontend only)

Every screen in §4 is built and clickable on mock data, so the UI can be reviewed before any backend exists. Run `npm run dev`. The README lists the demo shortcuts.

| Built | Where | Backend replaces it with |
|---|---|---|
| Login, Setup (key), Connect, Automations list + Create modal, Editor + phone preview, Settings | `src/app/**` | Same screens; data calls become Server Actions / route handlers |
| Domain model, defaults, Go Live validation, conflict rule | `src/lib/automations/{schemas,defaults,validate}.ts` | **Kept as is.** Shared by the API and worker (zod) |
| Adeli client interface + mock | `src/lib/adeli/{types,mock}.ts` | `src/lib/adeli/client.ts` implementing the same `AdeliClient` interface, server-only |
| App state (session, key, account, automations) | `src/lib/demo/store.ts` (localStorage) | Postgres tables in §6. Each `actions.*` maps to one Server Action of the same name |
| Route guard | `src/components/guard.tsx` | `proxy.ts` (session) + server redirects (key, account) |
| Demo controls | `src/components/demo/demo-controls.tsx` | Deleted |

Not in the preview: anything in M4 (runtime), real stats, the webhook route.

### M0. Scaffold
- [x] Next.js 16 + TypeScript + Tailwind v4 + ESLint (Prettier still to add)
- [x] shadcn init with Adeli's `components.json`, copy Adeli `components/ui/*`, `globals.css` and fonts from [`docs/brand.md`](brand.md) §2 and §10
- [ ] Drizzle + Postgres, `docker-compose.yml`, first migration (§6, including `app_settings`)
- [ ] `.env.example`, env validation with Zod
- [ ] Vitest set up, GitHub Actions CI (runs with `ADELI_MOCK=1`)
- [x] Adeli client interface + mock implementation (typed error mapping comes with the real client)

### M1. Login + Adeli key + Connect
- [ ] Password login, session cookie, `proxy.ts` guard (FR-0.x)
- [ ] Key resolver + AES-GCM encryption (`src/lib/adeli/key.ts`) with unit tests: env wins, round trip, wrong secret fails cleanly
- [x] (UI) `/setup` screen: checklist, instructions with deep links, key form, live validation, env-managed mode, mock skip (FR-S.1 to S.5, S.9)
- [ ] Setup guard: no key redirects to `/setup` (FR-S.1)
- [x] (UI) `/connect`: pick existing Adeli account, or connect new in poll mode, error states (FR-1.x)
- [x] (UI) Settings: Adeli key panel (test, replace, remove, profile mismatch warning), account reconnect / disconnect, log out (FR-S.6 to S.8, FR-1.6)
- [x] (UI) Global "key stopped working" banner (FR-S.7)

### M2. Automations list + Create modal
- [x] (UI) List page with empty state and row actions (FR-2.x)
- [x] Create modal with 1 enabled + 3 Coming soon cards (FR-3.x)
- [x] Defaults module (`defaults.ts`) producing a new Draft

### M3. Editor + Preview
- [x] Split layout + header bar + unsaved-changes guard (FR-4.x)
- [x] Sections A to F with validation and counters (FR-5.x)
- [x] Post picker grid with video hover preview (play overlay; real video previews need media URLs from Adeli)
- [x] Keyword chip input + Any comment option
- [x] Phone preview with 3 tabs and auto-switch (FR-6.x)
- [x] (UI) Save, Go Live, Pause, conflict check (FR-7.x, FR-9.x)

### M4a. Runtime on today's Adeli API
- [ ] Matcher (`match.ts`) with unit tests: contains, case, emoji, any comment, self-comments
- [ ] Interim comment poller (FR-8.1), event dedupe, once-per-person rule (by handle until A1/A5)
- [ ] pg-boss job: public comment reply via `POST /comments`, with retries and self-throttling
- [ ] Mock mode "Simulate comment" and "Simulate tap" for end-to-end testing without Instagram

### M4b. Runtime DMs (needs Track A)
- [ ] Opening DM as private reply with button (needs A2 + A3)
- [ ] Button tap handling and Final DM (needs A4, or A1 webhooks)
- [ ] Switch intake from polling to webhook route with signature check (needs A1), keep polling as fallback
- [ ] Pause behaviour, retries, `window_closed` handling (FR-8.x)

### Track A. Adeli API additions (in the Adeli repo)
Written up as a plan in `adeli/plans/` per that repo's rules. See §12A for the spec.
- [ ] A2 Private reply to a comment
- [ ] A3 Button messages (postback + URL)
- [ ] A1 Outbound webhook delivery for comment events (signed)
- [ ] A4 Postback (button tap) events in the same webhook
- [ ] A5 Commenter IG-scoped id on the public `Comment` shape
- [ ] A6 Confirm Meta app review covers `instagram_business_manage_comments` + `instagram_business_manage_messages` for private replies

### M5. Stats + polish
- [ ] Stat counts on list and editor (FR-10.x)
- [x] Mobile layout and preview drawer
- [ ] Accessibility pass

### M6. Open-source launch
- [ ] README with screenshots and quickstart, CONTRIBUTING, templates
- [ ] Architecture and extension guides
- [ ] Tag `v0.1.0`

---

## 11. Later (v1.1+)
- Link-click tracking via redirect links
- Treat a typed reply as a button tap
- "Any post" and "Next post" targeting
- Follow-gate before sending the link
- Image, Video and Card DMs, more buttons
- Direct Message, Story Reply, Story Mention triggers
- Facebook and TikTok channels
- Multi-user workspaces

---

## 12. Adeli dependencies

The original open questions were resolved on 2026-10-02 from the local `adeli` and `landing-page` repos.

**Resolved: Adeli API**
- [x] Base URL and auth: `https://app.tryadeli.com/api/v1`, `Authorization: Bearer rk_live_…`. One key = one Adeli profile, created at `/settings/api-keys`. No scopes. Anyone can sign up with Google.
- [x] Connect Instagram: `POST /profiles/{id}/connect` returns `authUrl` + session; poll the session. `redirectUrl` is optional and must be allowlisted by Adeli, so we use poll mode (FR-1.2).
- [x] List media: `GET /posts?platform=instagram`, normalized `media[]` with `type`, `url`, `thumbnailUrl`, plus `permalink`, `caption`. Unpaginated server-side up to 10k records.
- [x] Reply to a comment: `POST /comments` with `parentId`.
- [x] Error envelope and codes: `unauthorized` (401), `missing_permission` (403), `window_closed` (409), `rate_limited` (429), `provider_error` (502).
- [x] Comment events, private replies, buttons, postbacks: **not available yet**, see §12A.

**Resolved: design system** (details in [`docs/brand.md`](brand.md))
- [x] Colors, fonts, radius, components: Adeli dashboard tokens, Inter + Geist Mono, 10px radius, shadcn `base-nova` on Base UI.
- [x] Tailwind/shadcn already: yes, Tailwind v4 CSS-first. Copy `globals.css` and `components/ui/*` directly.
- [ ] Logo permission for a public MIT repo (brand.md §9). **Owner: Mika + Nick.**

### 12A. Adeli API additions needed for Comment to DM

These are changes to the Adeli API (Track A). Adeli Chat is the first customer, but each one is a general feature any Adeli user automating Instagram would want.

| # | Addition | Proposed shape | Why Adeli Chat needs it |
|---|---|---|---|
| A1 | **Outbound webhooks for comments.** Adeli already stores per-profile webhook URLs (`dashboard_webhook_endpoints`, set in the dashboard) but never delivers to them. Deliver Instagram `comments` events to that URL. | `POST {clientUrl}` with `{ id, type: "comment.created", platform, accountId, profileId, occurredAt, data: { commentId, postId, parentId, text, from: { id, username } } }`, header `Adeli-Signature: t=…,v1=HMAC-SHA256(secret, t + "." + body)`. Per-endpoint signing secret shown once. Retries with backoff. Also expose create/list via the API key (`/api/v1/webhooks`) so installs can self-register. | Real-time triggers (seconds, not up to 60s), no polling cost. |
| A2 | **Private reply to a comment.** | `POST /messages` accepts `{ "platform": "instagram", "accountId", "recipient": { "commentId": "…" }, ... }`, mapping to Meta's `recipient: { comment_id }`. Returns `409 window_closed` if the comment is older than 7 days, and a clear error if a private reply was already sent for that comment. | The Opening DM. Without it we can't DM a commenter at all. |
| A3 | **Button messages.** | `POST /messages` accepts `{ text, buttons: [{ type: "postback", title, payload } \| { type: "url", title, url }] }` (max 3, title max 20 chars, text max 640), mapping to Meta's button template. Works for both `recipient.id` and `recipient.commentId`. | Opening DM button and Final DM link button. |
| A4 | **Postback events.** | Same webhook as A1, `type: "message.postback"`, `data: { senderId, payload, title, mid }`. Optionally also `message.received` for v1.1 "typed reply counts as a tap". | Knowing when to send the Final DM. |
| A5 | **Commenter id on `Comment`.** | Add `authorId` (IG-scoped user id) to the public `Comment` shape on `GET /comments`. | Reliable once-per-person (D3) in polling mode; handles can change. |
| A6 | **Meta permissions check.** | Confirm the approved Instagram app covers private replies and button templates (`instagram_business_manage_comments`, `instagram_business_manage_messages`) for both Instagram Login and Facebook Login connections. | Avoid building against a permission we don't have in production. |

**Plan:** [`adeli/plans/2026-10-02-instagram-comment-to-dm-api-plan.md`](../../adeli/plans/2026-10-02-instagram-comment-to-dm-api-plan.md) (proposed, pending Nick's review). Milestone 1 = A2 + A3 + A5, Milestone 2 = A1 + webhook management API, Milestone 3 = A4.

**Recommended order:** A2 + A3 first (smallest change, unblocks the core DM flow, testable from the Adeli sandbox), then A1 + A4 together (one delivery system, two event types), then A5. Write it as one plan in `adeli/plans/` following that repo's plan template, and update `adeli/docs/public-api.md` and the public `/docs` pages in the same change.

**Still open**
- [ ] Rate limits: Adeli has no API rate limiting in v1. Confirm Meta's per-account limits for private replies and set our queue's throttle accordingly.
- [ ] Does Adeli want Adeli Chat listed in its docs as an example app? (Good distribution for both.)
