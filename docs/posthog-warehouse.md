# PostHog data warehouse

The hosted LedaChat syncs a small, read-only picture of its database into its PostHog project: who the users are, their Instagram accounts, their automations and how each one is doing. It sits beside the product events in [analytics.md](analytics.md), and `users.id` is the same id those events use as the PostHog distinct id, so the two join. Self-hosters don't need any of it.

## What syncs

PostHog reads only the views in the `posthog_analytics` schema, defined in `apps/web/scripts/posthog-warehouse.sql`:

| View | One row per | Columns |
| --- | --- | --- |
| `users` | user | id, name, email, email verified, sign-up time, Adeli profile id and name, connected accounts, automations, live automations, active API tokens, API token last used |
| `instagram_accounts` | connected Instagram account | id, user, Adeli account and profile ids, handle, display name, `connected` or `disconnected`, connected time |
| `automations` | automation | id, user, account, name, type, status, created, updated and live times, post scope, keyword or any match, keywords, and whether the comment reply, email capture and follow gate are on |
| `automation_stats` | automation | runs, completed runs (final DM sent), failed runs, leads, last run time |

Nothing else is readable: no sessions, OAuth or API tokens, webhook secrets, individual runs (commenters and their comments), lead emails, or the text of any DM or reply. Keep it that way when changing a view.

## How it's set up

- **Database.** The hosted app's database is `leda-chat` in the `adeli` Neon project, owned by the `leda_chat` role.
- **Login.** PostHog connects as `posthog_ledachat`. It was created with SQL (`CREATE ROLE ... LOGIN`), not the Neon console or API, so it is not a member of `neon_superuser`. It has `USAGE` on `posthog_analytics` and `SELECT` on its views, and nothing else. The views are owned by `leda_chat`, so they read the tables for it. Its password lives only in PostHog's source settings and the team's password manager.
- **Source.** A Postgres source in the LedaChat PostHog project, schema `posthog_analytics`, every view on full refresh **once a day at 09:00 UTC**. The tables are tiny, and one daily window means the sync wakes the shared Neon compute once instead of all day.

## Changing a view

1. Edit `apps/web/scripts/posthog-warehouse.sql`. It drops and recreates every view and re-grants them in one transaction, so it is safe to run again.
2. Run it against the hosted database as the owner:

       psql "<leda_chat direct connection string>" -v ON_ERROR_STOP=1 -f apps/web/scripts/posthog-warehouse.sql

3. In PostHog, refresh the source's schemas if you added or removed a view or column.

A migration that drops or retypes a column a view uses fails with "cannot drop column ... because other objects depend on it". Update this file in the same change: run its `DROP VIEW` statements before migrating, then rerun the file afterwards.

## Checking the login

Connected as `posthog_ledachat`, each view should answer and every table should not:

```sql
select count(*) from posthog_analytics.users;   -- a number
select count(*) from public.auth_user;          -- permission denied
```
