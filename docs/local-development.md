# Local development

How to run Adeli Chat against a local Adeli dev server, so a real Instagram comment can trigger a real DM.

The two apps use different ports:

| App | Port |
| --- | --- |
| Adeli dev server | 3000 |
| Adeli sandbox | 3001 |
| Adeli Chat | 3030 |

## 1. Run Adeli

In your Adeli checkout, start the dev server:

```bash
yarn dev:web
```

It listens on port 3000, behind your own ngrok domain. Meta must reach Adeli at a public HTTPS URL to deliver webhooks and finish Instagram authorization. Follow the Adeli repository's `GETTING_STARTED.md` (the ngrok section) to set up your domain. Adeli Chat itself still calls Adeli at `http://localhost:3000`.

Below, `<ngrok-domain>` means your own ngrok domain.

## 2. Set up the Meta app

1. Set the Instagram webhook callback URL to `https://<ngrok-domain>/api/instagram/webhook`, with the verify token from Adeli's `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
2. Subscribe to the `comments`, `messages` and `messaging_postbacks` fields.
3. Add two accounts as Instagram testers:
   - the business account that runs the automations;
   - a second account that leaves the comments.

While the Meta app is in development mode, it delivers webhooks and allows messaging only for accounts with a role on the app. That is why both accounts must be testers.

## 3. Set up local Adeli

1. Connect the business account with **Instagram Login**. Facebook Login connections lack the comments permission and subscription, so they don't work for Comment to DM.
2. Create an API key at `/settings/api-keys`.
3. Register `http://localhost:3030/connect` as a redirect URL under **Settings → OAuth**.

## 4. Run Adeli Chat

You need Node.js 22 or later and Docker.

### Postgres

```bash
docker compose up -d
```

Postgres 17 listens on `localhost:35438`, which doesn't collide with Adeli's own database on `35437`.

### The Adeli SDK

Adeli Chat calls Adeli through [`@adeli/sdk`](https://www.npmjs.com/package/@adeli/sdk), a normal dependency in `package.json`. `npm install` installs it.

### Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Value |
| --- | --- |
| `ADELI_BASE_URL` | `http://localhost:3000`. An origin only, with no `/api/v1` path. Leave it unset to use the hosted Adeli. |
| `ADELI_API_KEY` | The key you created in step 3. |
| `DATABASE_URL` | `postgres://adeli_chat:adeli_chat@localhost:35438/adeli_chat` |
| `ADMIN_PASSWORD` | Any password, used to log in to Adeli Chat. |
| `SESSION_SECRET` | At least 32 random characters. |
| `APP_URL` | `http://localhost:3030` |

### Start

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3030 and log in with `ADMIN_PASSWORD`. If `ADELI_API_KEY` is missing, Adeli Chat shows an error naming it. Nothing is mocked: every screen reads from your local Adeli and Postgres.

On start, and again whenever Setup confirms the key, Adeli Chat registers one Adeli webhook for `APP_URL/api/webhooks/adeli`, with the `comment.created` and `message.postback` events. It stores the webhook's id and signing secret in `app_settings`, and reuses it on later starts. Adeli accepts `http://localhost` webhook URLs, so a local Adeli can deliver to a local Adeli Chat without a tunnel.

### Tests

`npm test` runs the unit tests. The runtime tests use a separate `adeli_chat_test` database on the same Postgres, which they create and migrate themselves, so `docker compose up -d` must be running. They never call Adeli: a fake `fetch` stands in for it.

Before you push, run:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

After changing `src/lib/db/schema.ts`, create a migration with `npm run db:generate` and commit the new file in `drizzle/`.

Never commit `.env.local` or an API key. This repository is public.
