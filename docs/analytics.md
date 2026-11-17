# Analytics

The web app (`apps/web`) sends product analytics to PostHog. The landing page has no analytics. It's optional: without `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` nothing is sent (local development logs a reminder in the console). Self-hosters can leave it empty.

The hosted app also syncs a read-only picture of its users, accounts and automations into the same PostHog project; see [posthog-warehouse.md](posthog-warehouse.md).

Set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` and `NEXT_PUBLIC_POSTHOG_UI_HOST` in `apps/web/.env.local` and the app's Vercel project.

`NEXT_PUBLIC_` values are built into the page, so redeploy after changing them. Browser events go through `/ingest` on the app's domain (rewrites in `apps/web/next.config.ts`), so ad blockers don't drop them.

## How it's wired

- Browser: `apps/web/src/instrumentation-client.ts` starts PostHog (pageviews, page leave, autocapture, exceptions).
- Click events from markup: any element with `data-ph-event="name"` sends that event when clicked, with its other `data-ph-*` attributes as properties (`data-ph-for-mcp="true"` becomes `for_mcp: "true"`).
- Server: `apps/web/src/lib/analytics/server.ts` (`track`, `identifyUser`, `trackError`). Events are keyed by the LedaChat user id, the same id `<PostHogIdentify>` uses in the browser, so both land on one person. The sign-in page resets PostHog, so the next person on that browser starts fresh.
- Never put commenters' or leads' details (usernames, message text, emails) in event properties. Only ids, counts and outcomes.

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
