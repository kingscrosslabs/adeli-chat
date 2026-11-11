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

1. Create an API key at `/settings/api-keys`.
2. Register `http://localhost:3030/connect` as a redirect URL under **Settings → OAuth**.

You don't connect Instagram in Adeli itself. Adeli Chat creates a profile for each of its users in this organization, and you connect the business account from Adeli Chat (step 4) with **Instagram Login**. Facebook Login connections lack the comments permission and subscription, so they don't work for Comment to DM.

## 4. Run Adeli Chat

You need Node.js 24 and Yarn 4 (run `corepack enable` once; the repo pins Yarn in `.yarn/releases`). Adeli Chat calls Adeli through [`@adeli/sdk`](https://www.npmjs.com/package/@adeli/sdk), a normal dependency, so `yarn install` installs it.

```bash
corepack enable
yarn install
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
yarn dev
```

Open http://localhost:3030 and click **Connect Instagram**. Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` there's no login locally, and the one user is `local`. Set them (plus `BETTER_AUTH_SECRET`, and `http://localhost:3030/api/auth/callback/google` as a redirect URI in the Google OAuth client) to try sign-in. Each Google user gets their own Adeli profile when they sign up, named after their Google name and email; the `local` user gets one the first time it opens `/connect`. That local profile belongs to your database, not to the key: Adeli Chat never looks for an existing one in Adeli, so two developers sharing a key each get their own, named `Local: <user> on <host>`. Rename it under **Local profile** in Settings (shown only without login). Nothing is mocked: every screen reads from Adeli and the database.

On start, Adeli Chat applies any pending database migrations. It then registers an Adeli webhook on each user's profile, at `http://localhost:3030/api/webhooks/adeli/<userId>`, with the `comment.created`, `message.postback` and `message.created` events, and does it again whenever someone connects Instagram or clicks **Check connection** in Settings. On Vercel there's no "start", so only those register it, and the `vercel-build` script applies migrations. Each webhook's id and signing secret are stored in that user's `user_settings` row and reused on later starts. Adeli accepts `http://localhost` webhook URLs, so a local Adeli can deliver to a local Adeli Chat without a tunnel. If Adeli Chat runs somewhere else, set `APP_URL` to its address.

### Tests

`yarn test` runs the unit tests. Each test file gets its own in-memory PGlite database, so there's nothing to start first. The tests never call Adeli: a fake `fetch` stands in for it.

Before you push, run:

```bash
yarn typecheck && yarn lint && yarn test && yarn build
```

After changing `src/lib/db/schema.ts`, create a migration with `yarn db:generate` and commit the new file in `drizzle/`.

Never commit `.env.local` or an API key. This repository is public.
