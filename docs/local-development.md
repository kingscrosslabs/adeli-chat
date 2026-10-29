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

You need Node.js 22 or later. Adeli Chat calls Adeli through [`@adeli/sdk`](https://www.npmjs.com/package/@adeli/sdk), a normal dependency, so `npm install` installs it.

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required | Value |
| --- | --- | --- |
| `ADELI_API_KEY` | Yes | The key you created in step 3. |
| `ADELI_API_BASE_URL` | No | `http://localhost:3000` for a local Adeli. Leave it empty to use the hosted Adeli. A trailing `/api/v1` is fine. |
| `DATABASE_URL` | No | A Postgres connection string. Leave it empty and Adeli Chat uses PGlite, an in-process Postgres stored in `./.data`. |

Then start it:

```bash
npm run dev
```

Open http://localhost:3030. There's no login: Adeli Chat is a demo of the Adeli API, so run it on your own machine. If `ADELI_API_KEY` is missing, Setup tells you how to add it. Nothing is mocked: every screen reads from Adeli and the database.

On start, Adeli Chat applies any pending database migrations. It then registers one Adeli webhook for `http://localhost:3030/api/webhooks/adeli`, with the `comment.created` and `message.postback` events, and does it again whenever Setup confirms the key. It stores the webhook's id and signing secret in `app_settings`, and reuses it on later starts. Adeli accepts `http://localhost` webhook URLs, so a local Adeli can deliver to a local Adeli Chat without a tunnel. If Adeli Chat runs somewhere else, set `APP_URL` to its address.

### Tests

`npm test` runs the unit tests. Each test file gets its own in-memory PGlite database, so there's nothing to start first. The tests never call Adeli: a fake `fetch` stands in for it.

Before you push, run:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

After changing `src/lib/db/schema.ts`, create a migration with `npm run db:generate` and commit the new file in `drizzle/`.

Never commit `.env.local` or an API key. This repository is public.
