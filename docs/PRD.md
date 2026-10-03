# Adeli Chat: PRD + Build Plan v0.2 (Instagram Comment to DM)

> Status: **Approved for build (pending Adeli API + design details)** · Owner: @kingscrosslabs · Last updated: 2026-10-03

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
| D8 | Instagram access | Every Instagram call goes through **the Adeli API**, wrapped in our own typed client. Exact endpoints TBD from Adeli docs (see §12). |
| D9 | Design | Adeli design system. Tokens and components to be pulled from the Adeli landing-page / app repos (see §12). |

---

## 1. Goals and non-goals

### Goals (v1)
1. Connect an Instagram Professional (Business/Creator) account through the **Adeli API**.
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

> These are Meta's platform rules. Adeli's API may enforce or abstract some of them. Confirm against the Adeli docs (§12).

---

## 3. User stories

**Persona:** a creator or small-business marketer who posts "Comment **GUIDE** and I'll DM you the link."

| # | Story | Acceptance |
|---|---|---|
| U1 | I log in to my install. | Password screen. Wrong password shows an error. Session lasts 30 days. |
| U2 | I connect my Instagram account. | After connecting I see my handle and avatar, and my posts load in the editor. |
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
/                       Redirect to /automations, or /connect if no Instagram account
/connect                Connect Instagram (via Adeli)
/automations            List + "Create automation" button
  (modal)               Template picker
/automations/[id]       Split-screen editor
/settings               Connected account, reconnect, disconnect, log out
/api/webhooks/adeli     Incoming events from Adeli (comments, button taps)
```

---

## 5. Functional requirements

### 5.0 Login
- **FR-0.1** All pages except `/login` and `/api/webhooks/*` require a session.
- **FR-0.2** `/login` compares input to `ADMIN_PASSWORD` (constant-time). On success, set an HTTP-only signed cookie (`SESSION_SECRET`), 30-day expiry.
- **FR-0.3** Simple rate limit: 5 failed attempts per IP per 15 min.
- **FR-0.4** Log out clears the cookie.

### 5.1 Connect Instagram (via Adeli)
- **FR-1.1** "Connect Instagram" calls **our backend**, which calls the Adeli API to start the connect flow and redirects the user.
- **FR-1.2** On return, store the Adeli connection reference (Adeli account id, IG user id, handle, avatar, status). Do not store raw Meta tokens if Adeli holds them.
- **FR-1.3** Clear errors for: personal account, missing permissions, user cancelled, Adeli unavailable. Each with a retry button.
- **FR-1.4** Settings: show account, "Reconnect", "Disconnect". Disconnect pauses all Live automations.
- **FR-1.5** One connected Instagram account per install in v1. The data model allows more.

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
- **FR-8.1** Receive events from Adeli by webhook at `/api/webhooks/adeli`. Verify the signature. Respond 200 within 1s and queue the work. (If Adeli only supports polling, a scheduled job polls instead. TBD in §12.)
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

---

## 6. Data model

```
accounts
  id, provider ('instagram'), adeli_account_id, ig_user_id, handle, avatar_url,
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

Trigger and message configs are JSON so new triggers, DM types and channels don't need column-by-column migrations. Each JSON shape has a Zod schema shared by the UI, API and worker.

---

## 7. Architecture

```
Instagram ──comment──▶ Adeli ──webhook──▶ /api/webhooks/adeli ──▶ pg-boss queue ──▶ worker
                                                                       │
          ◀──── comment reply / private reply / DM via Adeli API ──────┘
```

- **App:** Next.js App Router + TypeScript. Server Actions for editor saves, route handlers for webhooks and auth.
- **UI:** Tailwind CSS + shadcn/ui primitives, themed with Adeli tokens in one place (`src/styles/tokens.css` + `tailwind.config.ts`).
- **Forms:** React Hook Form + Zod (same schemas on server).
- **DB:** Postgres + Drizzle ORM + drizzle-kit migrations.
- **Queue/worker:** pg-boss. Started from Next.js `instrumentation.ts` in the same Node process (simplest), with an option to run `npm run worker` separately.
- **Adeli client:** `src/lib/adeli/` typed client. Nothing else talks to Adeli directly.
- **Channel adapter:** `src/lib/channels/types.ts` defines `listMedia`, `replyToComment`, `sendPrivateReply`, `sendMessage`, `parseWebhook`. `instagram.ts` implements it via the Adeli client. Facebook and TikTok add files here later.
- **Mock mode:** `ADELI_MOCK=1` swaps in a fake Adeli client with sample posts and a "Simulate comment" button, so anyone can run the UI without Instagram.
- **Deploy target (v1):** one long-running container (Docker Compose locally, Railway/Render/Fly or a VPS in prod). Vercel isn't supported in v1 because of the background worker.

### Proposed folder structure
```
src/
  app/
    (auth)/login/page.tsx
    (app)/automations/page.tsx
    (app)/automations/[id]/page.tsx
    (app)/connect/page.tsx
    (app)/settings/page.tsx
    api/webhooks/adeli/route.ts
    api/connect/start/route.ts
    api/connect/callback/route.ts
  components/
    ui/                     shadcn primitives (Adeli-themed)
    automations/            list, create modal, status pill
    editor/                 sections A to F, header bar, chip input
    preview/                phone frame, post / comments / dm views
  lib/
    adeli/                  client.ts, mock.ts, types.ts
    channels/               types.ts, instagram.ts
    db/                     schema.ts, index.ts
    automations/            schemas.ts (zod), defaults.ts, validate.ts, conflicts.ts
    runtime/                match.ts, worker.ts, jobs.ts
    auth/                   session.ts
  styles/tokens.css
drizzle/                    migrations
docker-compose.yml
.env.example
```

### Environment variables
```
DATABASE_URL=
APP_URL=http://localhost:3000
ADMIN_PASSWORD=
SESSION_SECRET=
ADELI_API_KEY=
ADELI_API_BASE_URL=
ADELI_WEBHOOK_SECRET=
ADELI_MOCK=0
```

---

## 8. Non-functional requirements
- **Speed:** comment to Opening DM in under 10s at p95 (excluding Meta delays).
- **Reliability:** never two DM flows for the same person on the same automation. Webhook handler answers within 1s.
- **Security:** webhook signature check, secrets only in env, all app pages behind login, only store what's needed (IG user id, username, comment text).
- **Accessibility:** keyboard-friendly editor, labelled inputs, WCAG AA contrast.
- **Responsive:** usable down to 375px wide.
- **Compliance:** README reminds users to follow Meta Platform Terms and Instagram messaging policies.

---

## 9. Open-source requirements
- MIT license (present). README with screenshots and a 5-minute quickstart.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and PR templates.
- `docs/architecture.md`, plus guides for "Adding a channel" and "Adding a trigger".
- CI (GitHub Actions): lint, typecheck, unit tests, build.
- Seed script and mock mode so contributors can run everything without Instagram.

---

## 10. Build plan

Each milestone ends in something you can click through. Check boxes as we go.

### M0. Scaffold
- [ ] Next.js + TypeScript + Tailwind + ESLint + Prettier
- [ ] shadcn/ui init, Adeli tokens in `tokens.css` (placeholder until §12 is resolved)
- [ ] Drizzle + Postgres, `docker-compose.yml`, first migration (§6)
- [ ] `.env.example`, env validation with Zod
- [ ] Vitest set up, GitHub Actions CI
- [ ] Adeli client interface + mock implementation

### M1. Login + Connect
- [ ] Password login, session cookie, middleware guard (FR-0.x)
- [ ] Connect / callback routes via Adeli, accounts table, error states (FR-1.x)
- [ ] Settings page: reconnect, disconnect, log out

### M2. Automations list + Create modal
- [ ] List page with empty state and row actions (FR-2.x)
- [ ] Create modal with 1 enabled + 3 Coming soon cards (FR-3.x)
- [ ] Defaults module (`defaults.ts`) producing a new Draft

### M3. Editor + Preview
- [ ] Split layout + header bar + unsaved-changes guard (FR-4.x)
- [ ] Sections A to F with validation and counters (FR-5.x)
- [ ] Post picker grid with video hover preview
- [ ] Keyword chip input + Any comment option
- [ ] Phone preview with 3 tabs and auto-switch (FR-6.x)
- [ ] Save, Go Live, Pause, conflict check (FR-7.x, FR-9.x)

### M4. Runtime
- [ ] Webhook route with signature check + event dedupe
- [ ] Matcher (`match.ts`) with unit tests: contains, case, emoji, any comment, self-comments
- [ ] pg-boss jobs: comment reply, opening DM, final DM, with retries
- [ ] Button tap handling, once-per-person rule, pause behaviour (FR-8.x)
- [ ] Mock mode "Simulate comment" and "Simulate tap" for end-to-end testing without Instagram

### M5. Stats + polish
- [ ] Stat counts on list and editor (FR-10.x)
- [ ] Mobile layout and preview drawer
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

## 12. Still open (resolve from local Adeli repos)

These need the Adeli codebase / docs, which aren't reachable from the cloud session. Resolve them locally and update this doc.

**Adeli API (from `app.tryadeli.com/docs` or the Adeli repo)**
- [ ] Base URL and auth (API key header? per-user OAuth?)
- [ ] Connect Instagram: start URL, callback params, what we get back
- [ ] List media: endpoint, fields (thumbnail, video URL, type, caption, permalink), pagination
- [ ] Comment events: webhook (payload shape, signature header) or polling?
- [ ] Reply to a comment
- [ ] Private reply to a comment (send DM by `comment_id`) with a button
- [ ] Button tap / postback events: payload shape
- [ ] Send a DM with text + URL button
- [ ] Rate limits and error codes

**Adeli design system (from the landing-page / app repo)**
- [ ] Colors (brand, neutrals, success/warning/error), light and dark
- [ ] Fonts and type scale
- [ ] Radius, shadows, spacing
- [ ] Button, input, card, modal, pill styles
- [ ] Logo and favicon (and permission to use them in an OSS repo)
- [ ] Is it shadcn/Tailwind already? If yes, copy `tailwind.config` + `globals.css` directly
