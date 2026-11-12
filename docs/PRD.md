# LedaChat: PRD + Build Plan v0.3 (Instagram Comment to DM)

> Status: **Approved for build. UI milestones unblocked; runtime blocked on Adeli API additions (§12A)** · Owner: @kingscrosslabs · Last updated: 2026-11-11
>
> Companion docs: [`docs/brand.md`](brand.md) (name, logo, colours, voice) and [`docs/design.md`](design.md) (design system).

An open-source, self-hostable ManyChat alternative built on the Adeli API. v1 does one thing well: **when someone comments on your Instagram post, reply to their comment and send them a DM with a link.**

**Style rule for all copy in this repo (UI text, defaults, docs): no em dashes.**

---

## 0. Decisions log

| # | Question | Decision |
|---|---|---|
| D1 | Stack | Next.js (App Router) + TypeScript + Drizzle ORM. Postgres if `DATABASE_URL` is set, otherwise PGlite (in-process Postgres in `./.data`). Migrations apply on start. No job queue: webhook events are handled in `after()` and failures are recorded, not retried. (Updated 2026-10-29.) |
| D2 | Who logs in | Anyone with Google (Better Auth), each in their own workspace: their own Adeli key and URL, Instagram account, automations, runs and webhook. Nobody sees another user's data. Login is required when deployed and off locally without Google env vars (everything then belongs to the `local` user). `ALLOWED_EMAILS` optionally limits who may sign in. (Changed 2026-11-09.) |
| D3 | Repeat commenters | A person gets the DM flow **once per automation**. Later comments from them are ignored by that automation. |
| D4 | Editing a Live automation | **Save applies immediately** (after validation passes). |
| D5 | Any comment | Yes. Trigger can be **Specific keywords** or **Any comment**. |
| D6 | Stats | Basic counts only in v1. Link-click tracking is v1.1. |
| D7 | Defaults | Name `Comment to DM #n`. Replies listed in FR-5.10. No em dashes. |
| D8 | Instagram access | Every Instagram call goes through **the Adeli public API v1** via **`@adeli/sdk`**, called only from `apps/web/src/lib/adeli/` (`client.ts` maps SDK errors, `instagram.ts` holds the calls). `ADELI_API_BASE_URL` is optional (default `https://app.tryadeli.com`); an origin or one ending in `/api/v1` both work. Nothing is mocked: local development runs against a local Adeli dev server ([`docs/local-development.md`](local-development.md)). Endpoint map in §5.11. Updated 2026-10-27. |
| D9 | Design | Started from Adeli's dashboard design system (Tailwind v4 tokens + shadcn `base-nova` on Base UI), now LedaChat's own: Leda Purple and Leda Pink, light by default. Full reference in [`docs/design.md`](design.md). (Changed 2026-11-11.) |
| D10 | Adeli API key | **One server key, one profile per user** (updated 2026-11-10, replaces "bring your own key, entered in the app"). The install has one organization-level key in `ADELI_API_KEY` (URL in `ADELI_API_BASE_URL`, default hosted Adeli); nobody enters a key in the app, and the README has the steps to get one. Every LedaChat user gets their own profile in that organization, created with `client.profiles.createProfile` at sign-up (Better Auth `user.create.after`, and lazily by `ensureUserProfile` in `apps/web/src/lib/adeli/profile.ts`), named `Name (email)` from Google and tagged with `externalId = userId`. The local no-login user is the exception (updated 2026-11-11): every local database has a user with id `local`, so it never looks a profile up in Adeli. Without one stored in its own database it creates a new profile, named `Local: <user> on <host>` and tagged `adeli-chat-local-<random>`, so developers sharing a key never share a profile. A dev-only card in Settings renames it. Because the key reaches every profile, server code only ever uses the signed-in user's stored profile and accounts, never a profile or account id from the browser. `getAdeliConfig()` in `apps/web/src/lib/adeli/key.ts` is the only reader. Plan: [`plans/2026-11-10-env-key-and-per-user-profiles.md`](../plans/2026-11-10-env-key-and-per-user-profiles.md). |
| D11 | Connecting Instagram | **Instagram Login or Facebook Login** (updated 2026-11-11): `/connect` shows **Connect with Instagram** (primary) and **Connect with Facebook**. Each starts Adeli's connect session on the user's own profile with `authMethod` `"instagram_login"` or `"facebook_login"`, then saves the connected account. Accounts already on that profile are listed too. Pass this install's `/connect` URL as `redirectUrl`, and still poll the session before trusting completion. Picking the other login overrides the current one: Adeli refuses the switch (`409 auth_method_conflict`), so the server disconnects the user's own Instagram accounts on the old login in Adeli and starts the connect again. Reconnecting the same Instagram account keeps its automations. |
| D12 | Adeli API gaps | Missing Comment-to-DM primitives (§12A) are built **in the Adeli repo**, as a separate plan there. LedaChat waits for them rather than mocking them. |
| D13 | MCP server | `/mcp` exposes automations to Claude and other MCP clients (added 2026-11-09). Stateless Streamable HTTP via `@modelcontextprotocol/server`. Two ways in: personal API tokens (`adc_`, SHA-256 hashed, optional read only, optional expiry) for clients that send a header, and OAuth 2.1 from Better Auth's `mcp()` plugin (with CIMD and a DCR fallback) for Claude's custom connectors, which can't. Scopes `automations:read` and `automations:write`. Tools call the same service as the app. Plan: [`plans/2026-11-09-mcp.md`](../plans/2026-11-09-mcp.md). |

---

## 1. Goals and non-goals

### Goals (v1)
1. Guide a new install from zero to working: set an Adeli API key (README), sign in, connect an Instagram Professional (Business/Creator) account through the **Adeli API**.
2. Create, edit, save, go live with, and pause **Comment to DM** automations.
3. A ManyChat-style **split editor**: settings on the left, live phone preview on the right.
4. Reliable runtime: every matching commenter gets exactly one DM flow per automation. No duplicates, nothing lost on retries.
5. Easy to self-host and easy to contribute to.

### Non-goals (v1). Shown in the UI as "Coming soon" where relevant.
- Other triggers: Direct Message, Story Mention. (Story Reply shipped 2026-11-10, §5.13.)
- Other channels: Facebook, TikTok.
- Other DM types: Image, Video, Card.
- Phone collection, tags, broadcasts, AI replies.

Added 2026-11-09: "Next post" and "Any post" targeting, and an optional email step whose emails are saved as leads and exported as CSV (§5.12).
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

Think of the Adeli key as the **key to a mailroom**. Adeli holds the actual Instagram credentials (the provider tokens) and does the sending. LedaChat never sees an Instagram token. The install holds one organization-level Adeli key (`ADELI_API_KEY`), which can reach that organization's **profiles**. Each LedaChat user gets one profile, which owns their connected Instagram account.

```
LedaChat install ──(Bearer rk_live_… key)──▶ Adeli organization ──▶ one profile per LedaChat user ──▶ their Instagram account
```

Consequences:
- Whoever owns the key owns what the install can do. A clone of this repo must bring **its own** Adeli account and key. Sharing our key would let strangers post and DM as our connected accounts.
- The key reaches every user's profile, so LedaChat enforces the separation: every account, post, connect and webhook call uses the signed-in user's own profile or one of their own accounts.
- Each user selects one Instagram account in v1.

---

## 3. User stories

**Persona:** a creator or small-business marketer who posts "Comment **GUIDE** and I'll DM you the link."

| # | Story | Acceptance |
|---|---|---|
| U1a | Whoever runs an install is told they need an Adeli API key, and shown exactly how to get one. | README "Get your Adeli API key" with numbered steps and deep links to Adeli. Without `ADELI_API_KEY`, `/connect` points there. |
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
/                       Redirect: /connect if no Instagram account, else /automations
/connect                Connect Instagram on the user's own Adeli profile (/setup redirects here)
/automations            List + "Create automation" button
  (modal)               Template picker
/automations/[id]       Split-screen editor
/settings               Adeli status (server key, URL, your profile, check connection), connected account, reconnect, disconnect
/api/webhooks/adeli/[userId]  Incoming events from Adeli (comments, button taps), one webhook per user
```

Onboarding is a two-step checklist shown on `/connect`: **1. Instagram account · 2. First automation.** Each step shows done / current / next, so a new user always knows where they are.

---

## 5. Functional requirements

### 5.0b Adeli key and profiles (updated 2026-11-10, D10)
- **FR-S.1** The key is `ADELI_API_KEY` on the server, never entered in the app. The README's "Get your Adeli API key" section has the steps. Without it, `/connect` explains that whoever runs the install must set it, and the app pages show the key banner.
- **FR-S.2** Every user gets their own Adeli profile: `POST /api/v1/profiles` (`client.profiles.createProfile`) with `name` = Google name and email, `externalId` = user id, and an idempotency key per user. It runs at sign-up and again whenever a user has no stored profile (local user, sign-up while Adeli was down, database reset; the last finds the profile again by `externalId`).
- **FR-S.3** The key is never returned to the browser, logged, or put in a URL.
- **FR-S.6** Settings > Adeli: status (configured, missing, or rejected), Adeli URL, the user's profile name, and **Check connection** (makes sure the profile and webhook exist).
- **FR-S.7** Key revoked later (any Adeli call returns `401`): a global banner says the server's key was rejected and must be replaced in `ADELI_API_KEY`. It clears on the next accepted call.
- **FR-S.8** Access guard: every account, post and connect call is scoped to the signed-in user's profile or accounts. Switching to another account pauses the old account's Live automations.
- **FR-S.9** No mock mode. Contributors run against a local Adeli dev server ([`docs/local-development.md`](local-development.md)). Unit tests inject a fake `fetch` instead.

### 5.1 Connect Instagram (via Adeli)
- **FR-1.1** `/connect` calls `GET /api/v1/accounts?platform=instagram&profileId={profileId}` for the user's own profile only. Accounts already on it are shown as selectable cards (handle, display name, connection status).
- **FR-1.2** **Connect Instagram** (primary unless the profile already has accounts): our backend calls `POST /api/v1/profiles/{profileId}/connect` on the user's own profile with `{ "platform": "instagram", "redirectUrl": "{APP_URL}/connect" }`. The origin must be allowlisted by Adeli. Localhost and 127.0.0.1 may use HTTP; deployed installs use HTTPS. The UI opens the returned `authUrl` in a new tab and polls `GET /api/v1/profiles/{profileId}/connect/{sessionId}` every 2s, showing "Waiting for Instagram…" with a Cancel link. Adeli returns the authorization tab to `/connect`, but the server-side poll remains the source of truth. Sessions expire after 10 minutes.
- **FR-1.3** Login method: `authMethod: "instagram_login"` from **Connect with Instagram**, `"facebook_login"` from **Connect with Facebook** (D11).
- **FR-1.4** On `connected`, store the Adeli `accountId`, `providerId` (IG user id), `displayName`, `displayIdentifier` (handle) and status. We never store Instagram tokens (Adeli holds them).
- **FR-1.5** Errors: session `failed` or `expired`, user closed the tab, `403 missing_permission` on later calls (needs reconnect with comment + messaging permissions), personal account, Adeli unavailable. Each has a plain-language message and a retry button.
- **FR-1.6** Settings: show account, **Reconnect** (re-runs FR-1.2; Adeli keeps the same `accountId`), **Disconnect** (removes it from LedaChat only and pauses all Live automations; we do not call Adeli's delete, since the account may be used by other Adeli apps. A link explains how to fully remove it in Adeli).
- **FR-1.7** One connected Instagram account per install in v1. The data model allows more.

### 5.2 Automations list
- **FR-2.1** Columns: name, post thumbnail, trigger summary ("GUIDE, LINK" or "Any comment"), status pill, Triggered, Final DMs sent, last updated.
- **FR-2.2** Row actions: Edit, Pause/Go Live, Duplicate, Delete (confirm dialog; deleting a Live automation pauses it first).
- **FR-2.3** Empty state with a "Create automation" button.

### 5.3 Create automation modal
- **FR-3.1** Title "Create automation". One card per working trigger, no "Coming soon" cards (changed 2026-11-11):
  - **Comment to DM**: "Send a DM when someone comments a keyword on your post".
  - **Story Reply**: "Send a follow-up DM when someone replies to your story" (§5.13).
- **FR-3.2** Choosing Comment to DM or Story Reply creates a **Draft** of that type with all defaults and opens the editor.
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
- **FR-5.18** DM type selector: **Text + Buttons** (selected), the only type for now. Other types aren't shown until they work (changed 2026-11-11).
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
  - **Interim: polling.** A recurring job calls `GET /api/v1/comments?platform=instagram&accountId=…&postId=…` for each post with a Live automation every 60s, and treats comment ids it hasn't seen as new events. Works with today's API; slower (up to 60s) and costs one Adeli call per live post per minute.
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

### 5.11 Adeli API map (verified against the Adeli repo and public docs, 2026-10-14)

Base URL `https://app.tryadeli.com/api/v1`, header `Authorization: Bearer rk_live_…`. Errors use `{ "error": { "code", "message", "details" } }`. Aggregate reads may return `207` `partial`.

| LedaChat needs | Adeli endpoint | Status |
|---|---|---|
| Find a user's profile by `externalId` | `GET /profiles` | ✅ Available. The key belongs to the organization. |
| Create each user's profile | `POST /profiles` (`createProfile`, `Idempotency-Key`) | ✅ Available. |
| List connected IG accounts | `GET /accounts?platform=instagram&profileId=` | ✅ Available. `profileId` is required unless `accountId` names the profile. |
| Connect a new IG account | `POST /profiles/{id}/connect`, poll `GET /profiles/{id}/connect/{sessionId}` | ✅ Available. Send `{APP_URL}/connect` as the allowlisted `redirectUrl`, then confirm through polling. |
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


### 5.12 Post scopes, email step and leads (added 2026-11-09)
- **Scopes.** `trigger.postScope` is `specific` (one post, `mediaId`), `next` (the earliest post published at or after Go Live; the runtime binds `mediaId` on the first comment after that post exists, then it acts like `specific`) or `any` (every post). A comment goes to a matching `specific` automation first, then `next`, then `any`. Go Live's conflict rule applies within a scope only. Going live again resets a `next` automation's binding.
- **Email step.** Optional `emailCapture { enabled, text, retryText }`. After the tap the run moves to `awaiting_email` and we DM `text`. The person's next DM (Adeli `message.created`) with an email address unlocks the Final DM and saves a lead; a reply without one gets `retryText` once. Runs record the tap's sender id (`ig_sender_id`) so the reply can be matched.
- **Leads.** `leads` table, one per person per automation, kept when runs are reset. Export leads in the editor's menu downloads a CSV (`/api/automations/<id>/leads`).
- **Webhook.** The per-user webhook subscribes to `message.created` too; an older webhook without it is replaced on boot.

### 5.12b Follow gate (added 2026-11-11, Comment to DM only)
- **Editor.** "Ask them to follow you" (step 5), off by default. When on: Message (default "One last step! Follow me, then tap below and I'll send it over."), Button label (default "I'm following", max 20) and "If they still don't follow" (default "I don't see your follow yet. Follow me, then tap below again."). Stored in `automations.follow_gate` (jsonb, migration 0009). Story Reply never shows or applies it (`followGateOf`).
- **Runtime.** On the tap, before the email step, the runtime reads the tapper through Adeli `GET /messages/instagram/users/:igsid` (SDK `messages.getInstagramUser`, 0.5.0) and checks `isFollowing`. Meta only answers once the person has messaged or tapped, which the tap guarantees. `false`: send the Message with a postback button (payload: the run id) and set the run to `awaiting_follow`. A tap on that button claims the run again and re-checks; still not following gets the retry text. `true` or `null`: go on to the email step or the Final DM.
- **Fails open.** If the check errors, the flow continues as if they follow and the error is kept on the run, so a broken check never strands followers.
- **Stats.** Button taps count the first tap only.

### 5.13 Story Reply (added 2026-11-10)
- **Type.** `automations.type` is `comment_to_dm` or `story_reply`, set at create and never changed by a save. Duplicates keep it.
- **Trigger.** A `message.created` event whose `data.story.type` is `reply` (Adeli #188, SDK 0.4.0). Scope is `specific` (the default: one story, its id in `mediaId`, matched against `data.story.id`) or `any` (every story); `next` is never used. A story's own automation wins over Any story, like posts. The public reply is always off. Match is keywords (case-insensitive, on the reply text) or Any reply; a reply with no text (a reaction or sticker) only matches Any reply. Replies from the account itself never trigger.
- **Flow.** No public reply and no "Ask them to follow you" section in the editor (removed 2026-11-11). The Opening DM goes to `recipient.id` (the reply opened the conversation), then the tap, optional email step and Final DM run exactly as for comments. The run stores the reply's message id and text in `comment_id` and `comment_text`, so the existing unique keys make it once per person and idempotent on redelivery.
- **Priority.** A story reply that starts a Story Reply automation isn't also read as an email answer; any other story reply falls through to the email step.
- **Conflicts.** Go Live's conflict rule compares Story Reply automations only with each other, per scope: two automations on the same story, or two on Any story, can't share a keyword.
- **Picking a story** (added 2026-11-11). The editor lists the account's live stories from Adeli `GET /posts/instagram/stories` (SDK `posts.listInstagramStories`, 0.5.0) through `/api/adeli/stories`, and stores the pick as `mediaId` plus a `mediaSnapshot`. MCP has `list_stories` and a `storyId` field.
- **Expiry.** Instagram keeps a story up for 24 hours, so a specific-story automation stops getting replies then. It stays live (no job flips it), but the editor says the story has expired and the list shows "Expired story" (`storyExpired` in `schemas.ts`, from the snapshot's `publishedAt`).

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
  id, account_id, name, type ('comment_to_dm' | 'story_reply'),
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
Instagram ──comment──▶ Adeli ──webhook──▶ /api/webhooks/adeli ──▶ after() handler
                                                                       │
          ◀──── comment reply / private reply / DM via Adeli API ──────┘
```

- **Repo layout (2026-11-11):** Yarn 4 workspaces. `apps/web` is the app below; `apps/landing-page` is a static marketing site, deployed as its own Vercel project; `packages/ui` holds what both share (tokens, shadcn components, brand marks, `PhonePreview`, and the automation schemas and defaults). Paths below are inside `apps/web` unless they say otherwise. Plan: [`plans/2026-11-11-monorepo.md`](../plans/2026-11-11-monorepo.md).
- **App:** Next.js 16 App Router + TypeScript (match Adeli's version). Server Actions for editor saves, route handlers for webhooks and auth. Next 16 uses `proxy.ts` for the auth guard, not `middleware.ts`.
- **UI:** Tailwind CSS v4 (CSS-first, no `tailwind.config.ts`) + shadcn `base-nova` style on Base UI, with Adeli's component files copied into `packages/ui/src/components`. All tokens live in `packages/ui/src/theme.css`, which each app's `globals.css` imports. See [`docs/brand.md`](brand.md).
- **Forms:** React Hook Form + Zod (same schemas on server).
- **DB:** Drizzle ORM. Postgres when `DATABASE_URL` is set, otherwise PGlite in `apps/web/.data` (in memory under tests). `src/instrumentation.ts` applies the migrations in `drizzle/` on start; `yarn db:generate` creates new ones.
- **Runtime:** no queue. The webhook route verifies the signature, answers 200, and handles the event in `after()`. A failed step is recorded on the run and not retried.
- **Adeli client:** `@adeli/sdk`, used only in `src/lib/adeli/`. Nothing else talks to Adeli directly. `client.ts` builds the client from `getAdeliConfig()` (`src/lib/adeli/key.ts`, env only), maps SDK errors (`AuthenticationError`, `NetworkError`, `TimeoutError`, `ConfigurationError`, other `AdeliApiError` codes) to typed errors, and flags the key as rejected on any `401` (FR-S.7). `profile.ts` creates and finds each user's profile (FR-S.2). Server-only (`import "server-only"`).
- **Channel adapter:** `src/lib/channels/types.ts` defines `listMedia`, `replyToComment`, `sendPrivateReply`, `sendMessage`, `parseWebhook`. `instagram.ts` implements it via the Adeli client. Facebook and TikTok add files here later.
- **No mock mode:** the app runs against a real Adeli, locally a dev server ([`docs/local-development.md`](local-development.md)). Tests inject a fake `fetch`.
- **Deploy target (v1):** Vercel with Neon Postgres, or your own machine next to a local or hosted Adeli. The Adeli key and URL are entered in the app, not the environment.

### Proposed folder structure

The original proposal, kept for history. It now lives under `apps/web/`, with `components/ui`, `preview/` and `automations/{schemas,defaults}.ts` moved to `packages/ui` (see Repo layout above).

```
src/
  app/
    (onboarding)/connect/page.tsx
    (app)/automations/page.tsx
    (app)/automations/[id]/page.tsx
    (app)/settings/page.tsx
    api/webhooks/adeli/route.ts
    api/connect/start/route.ts      starts an Adeli connect session
    api/connect/status/route.ts     polls the session
    globals.css                     Adeli tokens (docs/design.md §8)
  components/
    ui/                     copied from adeli/apps/web/components/ui
    onboarding/             checklist, setup instructions, account picker
    automations/            list, create modal, status pill
    editor/                 sections A to F, header bar, chip input
    preview/                phone frame, post / comments / dm views
  lib/
    adeli/                  client.ts (SDK + error mapping), instagram.ts, types.ts, key.ts (reads env)
    channels/               types.ts, instagram.ts
    db/                     schema.ts, index.ts (Postgres or PGlite)
    automations/            schemas.ts (zod), defaults.ts, validate.ts, conflicts.ts
    runtime/                match.ts, worker.ts, jobs.ts, poll-comments.ts (interim intake)
proxy.ts                    setup guard (Next 16)
drizzle/                    migrations
.env.example
```

### Environment variables
```
DATABASE_URL=           # required on Vercel. Empty locally means PGlite in apps/web/.data
BETTER_AUTH_SECRET=     # required when deployed. Signs sessions and encrypts MCP API tokens
GOOGLE_CLIENT_ID=       # required when deployed. Locally, leave empty for no login
GOOGLE_CLIENT_SECRET=   # required when deployed
ALLOWED_EMAILS=         # optional. Empty means anyone with Google can sign in, each with their own workspace
APP_URL=                # optional. Defaults to the Vercel production domain, else http://localhost:3030
ADELI_API_KEY=          # required. The install's Adeli key; every user gets a profile in its organization
ADELI_API_BASE_URL=     # optional. Defaults to https://app.tryadeli.com
```

**Our own key (KCL):** for our hosted instance, set it as `ADELI_API_KEY` in Vercel. For local dev, put it in `apps/web/.env.local`. Never commit it. `.env*` stays gitignored, and CI runs the unit tests, which need no key.

---

## 8. Non-functional requirements
- **Speed:** comment to Opening DM in under 10s at p95 (excluding Meta delays).
- **Reliability:** never two DM flows for the same person on the same automation. Webhook handler answers within 1s.
- **Security:** webhook signature check, only store what's needed (IG user id, username, comment text). The Adeli key is stored encrypted, is server-only, never sent to the browser, never logged (redact `rk_live_*`). Deployed installs require Google sign-in; every page, Server Action and `/api/adeli/*` route checks the session.
- **Accessibility:** keyboard-friendly editor, labelled inputs, WCAG AA contrast.
- **Responsive:** usable down to 375px wide.
- **Compliance:** README reminds users to follow Meta Platform Terms and Instagram messaging policies.

---

## 9. Open-source requirements
- MIT license (present). README with screenshots and a 5-minute quickstart, including a **"Get your Adeli API key"** section (FR-S.1), and a note that the Adeli logo is used with permission (brand.md §6).
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and PR templates.
- `docs/architecture.md`, plus guides for "Adding a channel" and "Adding a trigger".
- CI (GitHub Actions): lint, typecheck, unit tests, build.
- No mock mode. [`docs/local-development.md`](local-development.md) explains how to run against a local Adeli dev server with test Instagram accounts.

---

## 10. Build plan

Each milestone ends in something you can click through. Check boxes as we go.

Two tracks run in parallel. **Track C** (this repo) could build M0 to M3 before the runtime existed. **Track A** (the Adeli repo, §12A) has to land before M4 can go fully live.

```
Track C (adeli-chat):  M0 ─ M1 ─ M2 ─ M3 ─ M4a (polling + comment replies) ─ M4b (DMs) ─ M5 ─ M6
Track A (adeli):        A2 + A3 (private reply, buttons) ─ A1 + A4 (webhooks) ─ A5    ▲
                                                     └─────────── unblocks ──────────┘
```

### Frontend preview (built 2026-10-03, frontend only)

Historical: every screen in §4 was first built on mock data in localStorage. The table below shows what replaced each piece; all of it is now done and the mock is gone.

| Built | Where | Backend replaces it with |
|---|---|---|
| Setup (key), Connect, Automations list + Create modal, Editor + phone preview, Settings | `src/app/**` | Same screens; data calls become Server Actions / route handlers |
| Domain model, defaults, Go Live validation, conflict rule | `src/lib/automations/{schemas,defaults,validate}.ts` | **Kept as is.** Shared by the API and worker (zod) |
| Adeli client interface + mock | `src/lib/adeli/{types,mock}.ts` | `src/lib/adeli/client.ts` implementing the same `AdeliClient` interface, server-only |
| App state (key, account, automations) | `src/lib/demo/store.ts` (localStorage) | Postgres tables in §6. Each `actions.*` maps to one Server Action of the same name |
| Route guard | `src/components/guard.tsx` | `proxy.ts` (key) + server redirects (account) |
| Demo controls | `src/components/demo/demo-controls.tsx` | Deleted |

Not in the preview: anything in M4 (runtime), real stats, the webhook route.

### M0. Scaffold
- [x] Next.js 16 + TypeScript + Tailwind v4 + ESLint (Prettier still to add)
- [x] shadcn init with Adeli's `components.json`, copy Adeli `components/ui/*`, `globals.css` and fonts from [`docs/brand.md`](brand.md) §2 and §10
- [x] Drizzle with Postgres or PGlite, migrations applied on start (§6, simplified: no `webhook_events`, the `runs` unique keys make delivery idempotent)
- [x] `.env.example`
- [ ] Env validation with Zod
- [x] Vitest set up (in-memory PGlite, fake `fetch`)
- [ ] GitHub Actions CI
- [x] Adeli client on `@adeli/sdk` with typed error mapping (the mock was removed 2026-10-27)

### M1. Adeli key + Connect
- [x] Key reader `src/lib/adeli/key.ts` (env only) with unit tests
- [x] `/setup` screen: checklist, instructions with deep links, live key check (replaced 2026-11-10 by `ADELI_API_KEY` and per-user profiles, D10)
- [x] Setup guard: no key redirects to `/setup` (replaced 2026-11-10: `/connect` explains a missing server key)
- [x] (UI) `/connect`: pick existing Adeli account, or connect new in poll mode, error states (FR-1.x)
- [x] Settings: Adeli key panel (status, test connection), account reconnect / disconnect (FR-S.6, FR-S.8, FR-1.6)
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
- [ ] Public comment reply via `POST /comments`, with retries and self-throttling

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

### M5b. MCP server (2026-11-09)
- [x] `/mcp` with automation tools (list, get, create, update, go live, pause, duplicate, delete, reset runs, list posts, workspace)
- [x] API tokens: create, revoke, read only, optional expiry (Settings)
- [x] OAuth for Claude connectors: discovery, CIMD + DCR, Google sign-in continuation, consent page, connected apps
- [x] MCP & APIs page (`/mcp-apis`, top level in the sidebar): Claude preset link, Claude Code command, manual config
- [ ] Verify the Claude connector end to end on the production domain

### M6. Open-source launch
- [ ] README with screenshots and quickstart, CONTRIBUTING, templates
- [ ] Architecture and extension guides
- [ ] Tag `v0.1.0`

---

## 11. Later (v1.1+)
- Link-click tracking via redirect links
- Treat a typed reply as a button tap
- Image, Video and Card DMs, more buttons
- Direct Message and Story Mention triggers
- Facebook and TikTok channels
- Multi-user workspaces

---

## 12. Adeli dependencies

The original open questions were resolved on 2026-10-02 from the local `adeli` and `landing-page` repos.

**Resolved: Adeli API**
- [x] Base URL and auth: `https://app.tryadeli.com/api/v1`, `Authorization: Bearer rk_live_…`. One key reaches every profile in its organization, and scoped requests must name `profileId` or `accountId`. Keys are created at `/settings/api-keys`. Anyone can sign up with Google.
- [x] Connect Instagram: `POST /profiles/{id}/connect` returns `authUrl` + session. Send the allowlisted `{APP_URL}/connect` as `redirectUrl`, and poll the session before accepting the result (FR-1.2).
- [x] List media: `GET /posts?platform=instagram`, normalized `media[]` with `type`, `url`, `thumbnailUrl`, plus `permalink`, `caption`. Unpaginated server-side up to 10k records.
- [x] Reply to a comment: `POST /comments` with `parentId`.
- [x] Error envelope and codes: `unauthorized` (401), `missing_permission` (403), `window_closed` (409), `rate_limited` (429), `provider_error` (502).
- [x] Comment events, private replies, buttons, postbacks: **not available yet**, see §12A.

**Resolved: design system** (details in [`docs/brand.md`](brand.md))
- [x] Colors, fonts, radius, components: Adeli dashboard tokens, Inter + Geist Mono, 10px radius, shadcn `base-nova` on Base UI.
- [x] Tailwind/shadcn already: yes, Tailwind v4 CSS-first. Copy `globals.css` and `components/ui/*` directly.
- [ ] Logo permission for a public MIT repo (brand.md §6). **Owner: Mika + Nick.**

### 12A. Adeli API additions needed for Comment to DM

These are changes to the Adeli API (Track A). LedaChat is the first customer, but each one is a general feature any Adeli user automating Instagram would want.

| # | Addition | Proposed shape | Why LedaChat needs it |
|---|---|---|---|
| A1 | **Outbound webhooks for comments.** Adeli already stores per-profile webhook URLs (`dashboard_webhook_endpoints`, set in the dashboard) but never delivers to them. Deliver Instagram `comments` events to that URL. | `POST {clientUrl}` with `{ id, type: "comment.created", platform, accountId, profileId, occurredAt, data: { commentId, postId, parentId, text, from: { id, username } } }`, header `Adeli-Signature: t=…,v1=HMAC-SHA256(secret, t + "." + body)`. Per-endpoint signing secret shown once. Retries with backoff. Also expose create/list via the API key (`/api/v1/webhooks`) so installs can self-register. | Real-time triggers (seconds, not up to 60s), no polling cost. |
| A2 | **Private reply to a comment.** | `POST /messages` accepts `{ "platform": "instagram", "accountId", "recipient": { "commentId": "…" }, ... }`, mapping to Meta's `recipient: { comment_id }`. Returns `409 window_closed` if the comment is older than 7 days, and a clear error if a private reply was already sent for that comment. | The Opening DM. Without it we can't DM a commenter at all. |
| A3 | **Button messages.** | `POST /messages` accepts `{ text, buttons: [{ type: "postback", title, payload } \| { type: "url", title, url }] }` (max 3, title max 20 chars, text max 640), mapping to Meta's button template. Works for both `recipient.id` and `recipient.commentId`. | Opening DM button and Final DM link button. |
| A4 | **Postback events.** | Same webhook as A1, `type: "message.postback"`, `data: { senderId, payload, title, mid }`. Optionally also `message.received` for v1.1 "typed reply counts as a tap". | Knowing when to send the Final DM. |
| A5 | **Commenter id on `Comment`.** | Add `authorId` (IG-scoped user id) to the public `Comment` shape on `GET /comments`. | Reliable once-per-person (D3) in polling mode; handles can change. |
| A6 | **Meta permissions check.** | Confirm the approved Instagram app covers private replies and button templates (`instagram_business_manage_comments`, `instagram_business_manage_messages`) for both Instagram Login and Facebook Login connections. | Avoid building against a permission we don't have in production. |

**Plan:** `~/repos/adeli/plans/2026-10-27-instagram-comment-to-dm-api-plan.md` in the Adeli repository (not public). Milestone 1 = A2 + A3 + A5, Milestone 2 = A1 + webhook management API, Milestone 3 = A4.

**Recommended order:** A2 + A3 first (smallest change, unblocks the core DM flow, testable from the Adeli sandbox), then A1 + A4 together (one delivery system, two event types), then A5. Write it as one plan in `adeli/plans/` following that repo's plan template, and update `adeli/docs/public-api.md` and the public `/docs` pages in the same change.

**Still open**
- [ ] Rate limits: Adeli has no API rate limiting in v1. Confirm Meta's per-account limits for private replies and set our queue's throttle accordingly.
- [ ] Does Adeli want LedaChat listed in its docs as an example app? (Good distribution for both.)
