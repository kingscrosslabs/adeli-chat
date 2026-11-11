# Analytics

Both apps send product analytics to PostHog, each to its own project. It's optional: without `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` nothing is sent (local development logs a reminder in the console). Self-hosters can leave it empty.

| App | Variables | Where |
| --- | --- | --- |
| `apps/web` | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_UI_HOST` | `apps/web/.env.local` and the app's Vercel project |
| `apps/landing-page` | The same three, with the landing page project's token | The landing page's Vercel project (or `apps/landing-page/.env.local`) |

`NEXT_PUBLIC_` values are built into the page, so redeploy after changing them. Browser events go through `/ingest` on each site (rewrites in `next.config.ts`), so ad blockers don't drop them.

## How it's wired

- Browser: `src/instrumentation-client.ts` in each app starts PostHog (pageviews, page leave, autocapture, and in the app, exceptions).
- Click events from markup: any element with `data-ph-event="name"` sends that event when clicked, with its other `data-ph-*` attributes as properties (`data-ph-location="hero"` becomes `location: "hero"`). The landing page uses only this, so it stays a server component.
- Server (app only): `apps/web/src/lib/analytics/server.ts` (`track`, `identifyUser`, `trackError`). Events are keyed by the LedaChat user id, the same id `<PostHogIdentify>` uses in the browser, so both land on one person. The sign-in page resets PostHog, so the next person on that browser starts fresh.
- Never put commenters' or leads' details (usernames, message text, emails) in event properties. Only ids, counts and outcomes.

## Landing page events

| Event | Properties |
| --- | --- |
| `start_free_clicked` | `location`: `header`, `hero`, `options_free`, `options_pro`, `final_cta` |
| `sign_in_clicked` | `location`: `header`, `footer` |
| `github_clicked` | `location`: `hero`, `options_self_host`, `footer` |
| `adeli_link_clicked` | `location`: `official_strip`, `options`, `official_api`, `official_api_docs`, `faq`, `footer` |
| `nav_link_clicked` | `section` |
| `faq_question_toggled` | `question` |

Every link event also has `href`. Plus PostHog's own `$pageview`, `$pageleave` (with scroll depth) and `$autocapture`.

## App events

Automation events have `automation_id` and `source`: `app` (the UI) or `mcp` (an AI agent).

| Event | Where | Properties |
| --- | --- | --- |
| `sign_in_started` | Browser, sign-in button | `for_mcp` |
| `user_signed_up` | Server, first Google sign-in | `provider` |
| `instagram_connect_started` / `instagram_connect_failed` | Browser, `/connect` | `method` (`instagram_login`, `facebook_login`), plus `status` on failure |
| `instagram_account_connected` | Server | `reconnected` |
| `instagram_account_disconnected` | Server | |
| `automation_created` | Server | `automation_type` |
| `automation_saved` / `automation_save_rejected` | Server | `reason`, `invalid_fields` on rejection |
| `automation_went_live` | Server | `automation_type`, `post_scope`, `trigger_match`, `keyword_count`, `comment_reply_enabled`, `email_capture_enabled`, `follow_gate_enabled`, `final_dm_buttons` |
| `automation_go_live_rejected` | Server | `reason` (`invalid`, `conflict`, `error`) |
| `automation_paused`, `automation_duplicated`, `automation_deleted`, `automation_runs_reset` | Server | |
| `leads_exported` | Server | `lead_count` |
| `agent_setup_opened` | Browser, Connect to AI Agent | `agent` |
| `api_token_created` / `api_token_revoked` | Server | `read_only`, `expiry` |
| `mcp_oauth_consent_allowed` / `mcp_oauth_consent_denied` | Server | `allow_write` |
| `mcp_app_disconnected` | Server | |
| `mcp_tool_called` | Server, every MCP tool call | `tool`, `write`, `ok` |

The automation runtime (`src/lib/runtime/handle.ts`) records each run's steps on the workspace owner, which gives the Comment to DM funnel:

| Event | Properties |
| --- | --- |
| `automation_triggered` | `trigger` (`comment`, `story_reply`), `post_scope`, `trigger_match` |
| `comment_reply_sent` | |
| `opening_dm_sent` | |
| `dm_button_tapped` | `email_capture_enabled`, `follow_gate_enabled` |
| `follow_gate_sent` | `recheck` (true when they tapped but do not follow yet) |
| `email_requested` | |
| `invalid_email_received` | |
| `lead_captured` | |
| `final_dm_sent` | `buttons` |
| `automation_step_failed` | `step` (`comment_reply`, `opening_dm`, `follow_gate`, `email_request`, `email_retry`, `final_dm`), `error_code` |

Webhook handling errors go to PostHog error tracking (`trackError`), with `adeli_event_type`.
