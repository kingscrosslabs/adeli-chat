-- PostHog data warehouse views for the hosted LedaChat (docs/posthog-warehouse.md).
--
-- Run as the database owner (the role the app connects as) after creating the
-- `posthog_ledachat` login. Safe to run again: it rebuilds every view and its
-- grants in one transaction. Self-hosters don't need it.
--
-- The views are the whole contract with PostHog. They hold who the users are,
-- their Instagram accounts, their automations' settings and per-automation
-- counts. Never add secrets (tokens, webhook secrets, sessions), commenters'
-- or leads' details, or message text.
--
-- A migration that drops or retypes a column used here fails until this file
-- drops the view first, so update this file in the same change.

BEGIN;

CREATE SCHEMA IF NOT EXISTS posthog_analytics;

DROP VIEW IF EXISTS posthog_analytics.users;
DROP VIEW IF EXISTS posthog_analytics.instagram_accounts;
DROP VIEW IF EXISTS posthog_analytics.automations;
DROP VIEW IF EXISTS posthog_analytics.automation_stats;

-- One row per user. `id` is also their PostHog distinct id.
CREATE VIEW posthog_analytics.users WITH (security_barrier = true) AS
SELECT
  u.id,
  u.name,
  u.email,
  u.email_verified,
  u.created_at AS signed_up_at,
  u.updated_at,
  s.adeli_profile_id,
  s.adeli_profile_name,
  (SELECT count(*) FROM public.accounts a WHERE a.user_id = u.id AND a.status = 'connected') AS connected_accounts,
  (SELECT count(*) FROM public.automations au JOIN public.accounts a ON a.id = au.account_id WHERE a.user_id = u.id) AS automations,
  (SELECT count(*) FROM public.automations au JOIN public.accounts a ON a.id = au.account_id WHERE a.user_id = u.id AND au.status = 'live') AS live_automations,
  (SELECT count(*) FROM public.api_tokens t WHERE t.user_id = u.id AND t.revoked_at IS NULL) AS active_api_tokens,
  (SELECT max(t.last_used_at) FROM public.api_tokens t WHERE t.user_id = u.id) AS api_token_last_used_at
FROM public.auth_user u
LEFT JOIN public.user_settings s ON s.user_id = u.id;

-- The Instagram accounts users connected.
CREATE VIEW posthog_analytics.instagram_accounts WITH (security_barrier = true) AS
SELECT
  a.id,
  a.user_id,
  a.adeli_account_id,
  a.adeli_profile_id,
  a.handle,
  a.display_name,
  a.status,
  a.created_at AS connected_at,
  a.updated_at
FROM public.accounts a;

-- Automation settings. The DM and reply text stays out.
CREATE VIEW posthog_analytics.automations WITH (security_barrier = true) AS
SELECT
  au.id,
  a.user_id,
  au.account_id,
  au.name,
  au.type,
  au.status,
  au.created_at,
  au.updated_at,
  au.live_at,
  au.trigger ->> 'postScope' AS post_scope,
  au.trigger ->> 'match' AS trigger_match,
  (SELECT string_agg(keyword, ', ') FROM jsonb_array_elements_text(au.trigger -> 'keywords') AS keyword) AS trigger_keywords,
  coalesce((au.comment_reply ->> 'enabled')::boolean, false) AS comment_reply_enabled,
  coalesce((au.email_capture ->> 'enabled')::boolean, false) AS email_capture_enabled,
  coalesce((au.follow_gate ->> 'enabled')::boolean, false) AS follow_gate_enabled
FROM public.automations au
JOIN public.accounts a ON a.id = au.account_id;

-- Per-automation counts. Individual runs and leads stay out.
CREATE VIEW posthog_analytics.automation_stats WITH (security_barrier = true) AS
SELECT
  au.id AS automation_id,
  a.user_id,
  count(r.id) AS runs,
  count(r.id) FILTER (WHERE r.state = 'final_sent') AS completed_runs,
  count(r.id) FILTER (WHERE r.state = 'failed') AS failed_runs,
  (SELECT count(*) FROM public.leads l WHERE l.automation_id = au.id) AS leads,
  max(r.created_at) AS last_run_at
FROM public.automations au
JOIN public.accounts a ON a.id = au.account_id
LEFT JOIN public.runs r ON r.automation_id = au.id
GROUP BY au.id, a.user_id;

REVOKE ALL ON SCHEMA posthog_analytics FROM PUBLIC;
GRANT USAGE ON SCHEMA posthog_analytics TO posthog_ledachat;
GRANT SELECT ON ALL TABLES IN SCHEMA posthog_analytics TO posthog_ledachat;

COMMIT;
