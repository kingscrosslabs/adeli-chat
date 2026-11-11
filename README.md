# Adeli Chat

Free, open-source Instagram Comment to DM automations (a ManyChat alternative), built on the [Adeli](https://tryadeli.com) API.

When someone comments a keyword on your post, Adeli Chat replies to their comment and sends them a DM with your link.

**Status:** the full Comment to DM flow runs against the Adeli API: a matching comment gets a public reply and an opening DM with a button, and a tap sends the final DM with your link. Automations and their stats live in Postgres, or in a local PGlite database if you don't set one up. See [docs/PRD.md](docs/PRD.md) for the spec and build plan, and [docs/brand.md](docs/brand.md) for the design system.

## Run it locally

```bash
corepack enable
yarn install
cp apps/web/.env.example apps/web/.env.local   # then set ADELI_API_KEY (see "Get your Adeli API key")
yarn dev
```

Open http://localhost:3030 and click **Connect Instagram**. Nothing is mocked. Every Adeli call goes through [`@adeli/sdk`](https://www.npmjs.com/package/@adeli/sdk).

Locally `ADELI_API_KEY` is the only variable you need: the database is PGlite in `apps/web/.data`, and without Google variables there's no login. `apps/web/.env.example` lists the optional ones. `apps/web/.env.local` is the only env file.

The repo is Yarn workspaces:

| Path | What | Dev |
| --- | --- | --- |
| `apps/web` | The app: automations, Instagram, webhooks, MCP | `yarn dev` (port 3030) |
| `apps/landing-page` | The static marketing site | `yarn dev:landing` (port 3031) |
| `packages/ui` | Theme tokens and components both apps share | |

`yarn typecheck`, `yarn lint`, `yarn test` and `yarn build` run in every workspace.

## How it uses Adeli

One Adeli Chat install uses one Adeli organization, through the API key in `ADELI_API_KEY`. Every person who signs in gets their own [profile](https://www.tryadeli.com/docs/api/profiles/create-profile) in that organization, created when they sign up and named after them (their Google name and email). Their Instagram account, posts and webhook all live on that profile, and Adeli Chat only ever reads or writes the signed-in person's own profile. People never need an Adeli account of their own: **Connect Instagram** runs Instagram Login through Adeli.

## Deploy to Vercel

1. **Import the repo** in Vercel and set **Root Directory** to `apps/web`. The other defaults work: the `vercel-build` script applies database migrations, then runs `next build`. Optionally, set **Ignored Build Step** to `sh scripts/vercel-ignored-build-step.sh` so production only redeploys when the app or `packages/ui` changed. It also skips preview deploys, so leave it empty if you want previews.
2. **Add Postgres.** In the project's Storage tab, add Neon from the Marketplace and connect it. It sets `DATABASE_URL`.
3. **Create a Google OAuth client** in Google Cloud Console (APIs & Services, Credentials, OAuth client ID, type "Web application"). Add the authorized redirect URI `https://<your-domain>/api/auth/callback/google`.
4. **Get an Adeli API key** (see "Get your Adeli API key" below).
5. **Set the environment variables** below, then redeploy.
6. **Allowlist the connect redirect.** In Adeli, under Settings, OAuth, add `https://<your-domain>/connect` so people can connect Instagram from Adeli Chat.
7. **Sign in with Google.** Everyone who signs in gets their own workspace: their own Adeli profile, Instagram account, automations and webhook. Nobody sees anyone else's. Set `ALLOWED_EMAILS` to limit who can sign in.
8. **Click Connect Instagram.** Adeli runs Instagram Login for your profile, then Adeli Chat registers a webhook just for you.

| Variable | Required | Notes |
| --- | --- | --- |
| `ADELI_API_KEY` | Yes | Your Adeli API key, `rk_live_...`. Every user's profile is created in its organization. |
| `ADELI_API_BASE_URL` | No | Leave empty for the hosted Adeli. Set it only if you run your own Adeli. |
| `DATABASE_URL` | Yes | Set by the Neon integration. Use the pooled connection string. |
| `BETTER_AUTH_SECRET` | Yes | Random, at least 32 characters: `openssl rand -base64 32`. Also encrypts MCP API tokens, so keep it stable. |
| `GOOGLE_CLIENT_ID` | Yes | From the Google OAuth client. |
| `GOOGLE_CLIENT_SECRET` | Yes | From the Google OAuth client. |
| `ALLOWED_EMAILS` | No | Comma-separated emails that may sign in. Empty: anyone with Google can sign in. |
| `BETTER_AUTH_API_KEY` | No | A [Better Auth Infrastructure](https://better-auth.com/docs/infrastructure/getting-started) project key. Set it to see and manage your users and sessions in its dashboard. |
| `APP_URL` | No | Set it when you use a custom domain. Defaults to the Vercel production domain. |

The Adeli API key stays on the server. It's never sent to the browser, and nobody enters a key in the app.

Google sign-in only works on domains registered in the OAuth client, so preview deployments with random URLs can't sign in unless you add them.

### Landing page (optional)

Self-hosting needs only the app. The marketing site in `apps/landing-page` is a second Vercel project: Root Directory `apps/landing-page`, Ignored Build Step `sh scripts/vercel-ignored-build-step.sh`, and `APP_URL` set to the app's address (for example `https://app.example.com`), which its sign-in links point to. A production build without `APP_URL` fails.

To test the whole flow against a local Adeli dev server, with a real comment triggering a real DM, follow [docs/local-development.md](docs/local-development.md).

## Use with Claude (MCP)

Adeli Chat is also an MCP server at `https://<your-domain>/mcp`, so Claude can list, create and manage your automations: "make a Comment to DM automation for my latest reel that sends the GUIDE link", "pause everything on that post", "how did last week's automations do".

Open **Connect to AI Agent** in the app sidebar (`/mcp-apis`). It has a setup guide for Claude, ChatGPT (and Codex), Cursor, Perplexity and any other MCP client, with your URL filled in.

- **Claude, ChatGPT, Cursor and Perplexity** sign in with Google (OAuth) and ask what they may do. Turn off "changes" for a read-only connection. Disconnect any of them under **Connected apps**. This needs Google sign-in, so it's off in local no-login mode.
- **Claude Code:**
  ```bash
  claude mcp add --transport http adeli-chat https://<your-domain>/mcp
  ```
  then type `/mcp` in Claude Code and choose Authenticate.
- **Other MCP clients:** use the server URL with `Authorization: Bearer <token>`.

API tokens start with `adc_`. Every user gets a **Default** token, and you can create more that are read only or expire after 30, 90 or 365 days. Tokens are stored as a hash plus an encrypted copy, so you can reveal and copy them again later, as with Adeli's API keys. Tokens created before that stay hidden. A token or connection only reaches your own automations.

Tools: `get_workspace`, `list_automations`, `get_automation`, `list_posts`, `create_automation` (always a draft), `update_automation`, `go_live`, `pause_automation`, `duplicate_automation`, `delete_automation`, `reset_runs`. They use the same validation as the editor, so an automation Claude takes live passes the same checks.

## Get your Adeli API key

Whoever runs the install needs one Adeli API key. The people who sign in to Adeli Chat don't.

1. **Create an Adeli account.** Go to [app.tryadeli.com](https://app.tryadeli.com/sign-in) and sign in with Google. Your first sign-in creates your organization.
2. **Create an API key.** Open [API keys](https://app.tryadeli.com/settings/api-keys), label it "Adeli Chat", and click **Create key**. It needs to be able to create profiles, connect accounts, read posts, reply to comments, send messages and manage webhooks.
3. **Copy the key now.** Adeli shows it only once. It starts with `rk_live_`.
4. **Set it as `ADELI_API_KEY`:** in `apps/web/.env.local` for local development, or in the Vercel project's environment variables. Restart or redeploy afterwards.

Never commit a key. If Adeli stops accepting it, Adeli Chat shows a banner on every page until you replace it.

## Notes

- Follow Meta's Platform Terms and Instagram's messaging policies when you run automations.
- The code is MIT licensed. The Adeli logo in `apps/web/public/brand/` and `apps/landing-page/public/brand/` is used with permission and isn't covered by the MIT license; forks should swap it.
