# Adeli Chat — PRD v0.1 (Instagram Comment → DM)

> Status: **Draft for review** · Owner: @kingscrosslabs · Last updated: 2026-10-03

An open-source, self-hostable ManyChat alternative built on the Adeli API. v1 does one thing well: **when someone comments a keyword on your Instagram post, reply to their comment and send them a DM with a link.**

---

## 1. Goals & non-goals

### Goals (v1)
1. Connect an Instagram Professional (Business/Creator) account through the **Adeli API**.
2. Create, edit, save, go live with, and pause **Comment → DM** automations.
3. A ManyChat-style **split editor**: settings on the left, live phone preview on the right.
4. Reliable runtime: every matching comment gets exactly one reply flow (no duplicates, no missed events on retry).
5. Easy to self-host and easy to contribute to (clear structure, channel adapters, docs).

### Non-goals (v1) — shown in UI as "Coming soon" where relevant
- Other triggers: Direct Message, Story Reply, Story Mention.
- Other channels: Facebook, TikTok.
- Other DM types: Image, Video, Card.
- Post targeting other than a single specific post ("Any post", "Next post").
- Follow-gating, email/phone collection, contact tagging, broadcasts, AI replies.
- Multi-step visual flow builder (node canvas).
- Billing / multi-tenant SaaS features.

---

## 2. How Instagram Comment → DM actually works (constraints that shape the UX)

Think of Instagram DMs like a shop with a locked door. A comment lets you slip **one note** under the door (a *private reply*). You can't walk in until the customer opens the door — i.e. taps a button or replies. That's why ManyChat (and we) require an **Opening DM** with a button: the tap opens the door (a 24-hour messaging window), and only then can the **Final DM** with the link be sent.

| Meta constraint | Effect on product |
|---|---|
| A private reply to a comment is allowed **once per comment**, within **7 days** of the comment. | Opening DM is a single message; send it fast; never retry after a success. |
| Further DMs require the user to interact (button tap / message) → opens a **24h window**. | Final DM is sent on the Opening DM button tap (postback). |
| Button template: message text ≤ **640 chars**, ≤ **3 buttons**, button title ≤ **20 chars**. | Field-level validation + character counters. |
| Account must be Instagram **Professional** and grant messaging/comment permissions. | Connect flow must surface clear errors for personal accounts / missing scopes. |
| Meta rate limits on automated DMs/replies. | Queue with backoff; surface "delayed" status rather than dropping. |

> These are Meta's rules; Adeli's API may wrap them. Exact limits to be confirmed against the Adeli API docs (see Open Questions).

---

## 3. Users & core user stories

**Persona:** creator / small-business marketer who posts "Comment **GUIDE** and I'll DM you the link."

| # | Story | Acceptance |
|---|---|---|
| U1 | As a user, I connect my Instagram account. | After connecting, I see my handle + avatar and my posts load in the editor. |
| U2 | I click **Create automation** and pick a template. | Modal shows "Comment to DM" (enabled) and 3 "Coming soon" options (disabled). |
| U3 | I pick the post people will comment on. | Grid of my recent posts/reels/carousels with thumbnails; video thumbnails play/preview; exactly one must be selected. |
| U4 | I set one or more trigger keywords. | Type + Enter (or comma) creates a chip; case-insensitive "contains" match. |
| U5 | I write public comment replies. | ≥3 reply variants pre-filled; one is chosen at random per comment. |
| U6 | I customise the Opening DM and its button. | Defaults pre-filled; required. |
| U7 | I customise the Final DM text + link button. | Defaults pre-filled; URL validated. |
| U8 | I see a live preview of Post / Comment / DM as I edit. | Phone mock updates on every keystroke; tab auto-switches to the section I'm editing. |
| U9 | I save a draft or go live; later I pause. | Status pill + button state change accordingly (see §5.9). |
| U10 | I see my automations in a list with status and basic counts. | Name, post thumbnail, keywords, status, # triggered, # final DMs sent. |

---

## 4. Information architecture

```
/                       → redirect to /automations (or /connect if no account)
/connect                → Connect Instagram (via Adeli)
/automations            → list + "Create automation" button
  (modal) New automation → template picker
/automations/:id        → split-screen editor
/settings               → connected account, disconnect, API key status
```

---

## 5. Functional requirements

### 5.1 Connect Instagram (via Adeli)
- **FR-1.1** "Connect Instagram" button calls **our backend**, which calls the Adeli API to start the connect/OAuth flow and redirects the user.
- **FR-1.2** On callback, backend stores the Adeli connection reference (account id, handle, avatar, connection status). **No raw Meta tokens stored by us** if Adeli holds them.
- **FR-1.3** Error states: personal (non-professional) account, missing permissions, user cancelled, Adeli API unavailable — each with a human message and retry.
- **FR-1.4** Settings page: show connected account, "Reconnect", "Disconnect". Disconnect pauses all live automations.
- **FR-1.5** v1 supports **one connected Instagram account per install** (data model allows many).

### 5.2 Automations list
- **FR-2.1** Table/cards: name, post thumbnail, keywords (truncated), status pill (Draft / Live / Paused), Triggered, DMs sent, last updated.
- **FR-2.2** Row actions: Edit, Pause/Resume, Duplicate, Delete (confirm dialog; deleting a Live automation pauses first).
- **FR-2.3** Empty state with illustration + "Create automation" CTA.

### 5.3 Create automation modal
- **FR-3.1** Title: "Create automation". Four cards:
  - **Comment to DM** — "Send a DM when someone comments a keyword on your post" — *enabled*.
  - **Direct Message** — "Reply instantly when someone DMs you on autopilot" — *Coming soon*.
  - **Story Reply** — "Send a follow-up DM when someone replies to your story" — *Coming soon*.
  - **Story Mention** — "Reply automatically when someone mentions you in their story" — *Coming soon*.
- **FR-3.2** Selecting Comment to DM creates a **Draft** with all defaults and opens the editor.
- **FR-3.3** If no Instagram account is connected, the modal prompts to connect first.

### 5.4 Editor layout
- **FR-4.1** Two columns ≥1024px: **left** = scrollable form (~45%), **right** = sticky phone preview (~55%). Below 1024px: form full-width with a "Preview" toggle/drawer.
- **FR-4.2** **Header bar:** back link, editable automation name (inline), status pill, last-saved indicator ("Saved · 2m ago" / "Unsaved changes"), **Save** and **Go Live / Pause** buttons.
- **FR-4.3** Warn on navigation with unsaved changes.

### 5.5 Editor sections (left side, top to bottom)

**A. Automation name**
- **FR-5.1** Default: `Comment to DM #<n>` (n = count of existing automations + 1). Required, ≤ 80 chars.

**B. When someone comments on**
- **FR-5.2** Option "A specific post or reel" (selected). "Any post or reel" and "Next post or reel" shown as *Coming soon*.
- **FR-5.3** Grid of the account's media fetched via our API → Adeli: reels, videos, images, carousels. Show thumbnail, media-type icon, caption snippet, date. Paginated / "Load more".
- **FR-5.4** Video/reel tiles show a muted autoplay-on-hover preview (or play icon if only a thumbnail is available).
- **FR-5.5** Exactly one post required to go live. Selected post appears in the preview.

**C. Trigger keyword**
- **FR-5.6** Text input; **Enter**, **comma** or **Tab** converts text into a chip; × removes; Backspace on empty input removes last chip.
- **FR-5.7** Matching: case-insensitive, trimmed, **contains** (e.g. keyword `guide` matches "Can I get the GUIDE pls"). Emoji supported. Duplicate keywords prevented.
- **FR-5.8** ≥1 keyword required to go live. Max 20 keywords, each ≤ 50 chars.
- **FR-5.9** Helper text: "Matches comments that contain any of these words. Not case-sensitive."

**D. Reply to their comment**
- **FR-5.10** Toggle (default **on**). When on, list of reply variants; default 3 pre-filled:
  1. "Sent you a DM! 📩"
  2. "Check your DMs 👀"
  3. "Just sent it over — check your inbox ✨"
- **FR-5.11** "+ Add reply" (max 10). Delete per row. When toggle is on, ≥1 non-empty reply required (3 recommended; helper text: "We'll pick one at random so replies look natural").
- **FR-5.12** One variant chosen uniformly at random per matched comment.

**E. Opening DM (required)**
- **FR-5.13** Message textarea, default: "Hey there! Click below and I'll send you the link in a second." ≤ 640 chars, counter shown.
- **FR-5.14** Button label, default: "Yes please". ≤ 20 chars. Required.
- **FR-5.15** Info tooltip explaining *why* it's required (Instagram only allows one message until the person taps).

**F. Final DM**
- **FR-5.16** DM type selector: **Text + Buttons** (selected); Image, Video, Card shown disabled with *Coming soon*.
- **FR-5.17** Message textarea, default "Here it is! Enjoy!" ≤ 640 chars.
- **FR-5.18** Button #1: label default "Click for link!" (≤ 20 chars), URL default `https://tryadeli.com` (must be valid `https://`).
- **FR-5.19** Data model supports up to 3 buttons; v1 UI exposes 1 ("+ Add button" can come later).

### 5.6 Preview (right side)
- **FR-6.1** iPhone-style frame rendered in Instagram's visual language (not pixel-copied; no Meta logos).
- **FR-6.2** Segmented tabs: **Post · Comments · DM**.
  - **Post:** selected media (or placeholder), handle + avatar, caption snippet.
  - **Comments:** sample commenter writing the first keyword ("GUIDE"), then your account's reply (first variant) threaded beneath.
  - **DM:** Opening DM bubble + button → user "tap" bubble (button label) → Final DM bubble + link button.
- **FR-6.3** Preview updates live as fields change; focusing a section auto-switches tab (B→Post, C/D→Comments, E/F→DM).

### 5.7 Validation
- **FR-7.1** Save is always allowed (drafts can be incomplete).
- **FR-7.2** Go Live runs full validation; failing fields are highlighted, the editor scrolls to the first error, and a toast summarises ("2 things to fix before going live").
- **FR-7.3** Conflict rule: two **Live** automations on the same post with overlapping keywords are blocked at Go Live with a message linking to the other automation.

### 5.8 Runtime (backend)
- **FR-8.1** Receive comment events (webhook from Adeli, or polling if Adeli doesn't push — TBD). Verify signature.
- **FR-8.2** Ignore: comments by the account itself, replies to our own replies, comments on non-targeted posts, events for non-Live automations.
- **FR-8.3** On keyword match, enqueue a run and execute:
  1. (if enabled) reply publicly to the comment with a random variant;
  2. send **Opening DM** as a private reply to the comment, with a postback button carrying the run id.
- **FR-8.4** On button postback (user taps "Yes please") → send **Final DM** (text + URL button). Idempotent: a second tap does not resend the Final DM (v1 = send once; configurable later).
- **FR-8.5** **Once per person per automation**: a commenter who triggers again on the same automation does not get another DM (comment reply still optional — v1: skip both).
- **FR-8.6** Idempotency on webhook event id; at-least-once processing with dedupe.
- **FR-8.7** Retry with exponential backoff on transient errors/rate limits (max 5); never retry a private reply that succeeded; record permanent failures with reason.
- **FR-8.8** Pausing stops new runs immediately; in-flight runs waiting on a button tap still get their Final DM (configurable later).

### 5.9 Status & button states
| Status | Pill | Primary button | Secondary |
|---|---|---|---|
| Draft (never live) | grey "Draft" | **Go Live** | Save |
| Live | green "Live" (pulse dot) | **Pause** | Save |
| Paused | amber "Paused" | **Go Live** (Resume) | Save |

- **FR-9.1** Saving a Live automation applies changes immediately (after validation passes; otherwise save is rejected with errors).
- **FR-9.2** Go Live = save + validate + activate in one click.

### 5.10 Basic stats (v1 minimum)
- **FR-10.1** Per automation: Triggered (matched comments), Comment replies sent, Opening DMs sent, Button taps, Final DMs sent. Shown in list and editor header.
- **FR-10.2** Link-click tracking (redirect URL) — v1.1.

---

## 6. Data model (draft)

```
Account          id, provider('instagram'), adeliAccountId, handle, avatarUrl, status, createdAt
Automation       id, accountId, name, type('comment_to_dm'), status('draft'|'live'|'paused'),
                 trigger   { mediaId, mediaSnapshot{thumbUrl,type,caption}, keywords[] }
                 commentReply { enabled, variants[] }
                 openingDm { text, buttonLabel }
                 finalDm   { type('text_buttons'), text, buttons[{label,url}] }
                 createdAt, updatedAt, liveAt
Run              id, automationId, igUserId, igUsername, commentId, commentText,
                 state('matched'|'replied'|'opening_sent'|'clicked'|'final_sent'|'failed'|'skipped'),
                 error, createdAt, updatedAt     UNIQUE(automationId, igUserId)
WebhookEvent     id(provider event id), receivedAt, processedAt, payload   (dedupe)
```
Trigger/action configs stored as JSON so new triggers/DM types/channels don't need migrations per field.

---

## 7. Architecture & stack (proposed — pending Adeli design-system answer)

- **App:** Next.js (App Router) + TypeScript, single repo, server actions/route handlers for API.
- **UI:** Adeli design system (tokens, components, fonts) — see Q2.
- **DB:** Postgres via Drizzle ORM (SQLite option for local dev).
- **Jobs:** Postgres-backed queue (e.g. `pg-boss`) — no Redis required for self-hosters.
- **Adeli client:** `lib/adeli/` typed client; all Instagram calls go through it.
- **Channel adapter interface** (`lib/channels/instagram.ts`, later `facebook.ts`, `tiktok.ts`): `listMedia`, `replyToComment`, `sendPrivateReply`, `sendMessage`, `parseWebhook`.
- **Deploy:** `docker compose up` (app + postgres); one-click Vercel/Railway notes in README.
- **Config:** `.env.example` → `ADELI_API_KEY`, `ADELI_WEBHOOK_SECRET`, `DATABASE_URL`, `APP_URL`, `ADMIN_PASSWORD`.

```
Instagram ──comment──▶ Adeli ──webhook──▶ /api/webhooks/adeli ──▶ queue ──▶ worker
                                                                  │
            ◀── reply / private reply / DM via Adeli API ─────────┘
```

---

## 8. Non-functional requirements
- **Latency:** comment → Opening DM p95 < 10s (excluding Meta delays).
- **Reliability:** no duplicate DMs per (automation, user); webhook handler returns 200 in < 1s (work is queued).
- **Security:** webhook signature verification; secrets only in env; app protected by login (see Q4); no PII beyond IG user id/username/comment text; data retention configurable.
- **Accessibility:** keyboard-navigable editor, labelled inputs, WCAG AA contrast.
- **Responsive:** usable down to 375px.
- **Compliance:** README notes users must follow Meta Platform Terms & Instagram messaging policies.

---

## 9. Open-source / contributor requirements
- MIT license (already present), `README` with screenshots + quickstart, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue/PR templates.
- `docs/architecture.md` + "Adding a new channel" and "Adding a new trigger" guides.
- CI: lint, typecheck, unit tests (keyword matcher, validation, run state machine), build.
- Seed script + **mock Adeli mode** (`ADELI_MOCK=1`) so contributors can run the UI without an Instagram account.

---

## 10. Milestones

| # | Milestone | Scope |
|---|---|---|
| M0 | Scaffold | Next.js, design system, DB, CI, mock Adeli client |
| M1 | Connect | Connect/disconnect Instagram via Adeli, settings page |
| M2 | Editor UI | Modal, split editor, all sections, live preview, validation, save |
| M3 | Runtime | Webhook ingest, matcher, queue, comment reply, Opening DM, postback → Final DM |
| M4 | Go Live | Status lifecycle, conflict check, stats, list page |
| M5 | OSS polish | Docs, docker compose, contributor guides, screenshots |

---

## 11. Open questions
See the question list in the PR / chat thread; answers will be folded back into this doc.

1. Adeli API docs/spec: connect flow, media list, comment webhooks, private reply, button/postback DMs, comment reply?
2. Adeli design system: where does it live (npm package, Figma, repo, Tailwind config)?
3. Stack preference (Next.js + Postgres OK?).
4. Who logs in: single-owner self-host vs multi-user?
5. Repeat commenters, "any comment" keyword, link-click tracking in v1?
