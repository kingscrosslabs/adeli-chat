# Adeli Chat

Free, open-source Instagram Comment to DM automations (a ManyChat alternative), built on the [Adeli](https://tryadeli.com) API.

When someone comments a keyword on your post, Adeli Chat replies to their comment and sends them a DM with your link.

**Status:** the full Comment to DM flow runs against the Adeli API: a matching comment gets a public reply and an opening DM with a button, and a tap sends the final DM with your link. Automations and their stats live in Postgres, or in a local PGlite database if you don't set one up. See [docs/PRD.md](docs/PRD.md) for the spec and build plan, and [docs/brand.md](docs/brand.md) for the design system.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3030 and paste your Adeli API key on the Setup page (see below). Nothing is mocked. Every Adeli call goes through [`@adeli/sdk`](https://www.npmjs.com/package/@adeli/sdk).

Locally no environment variables are needed: the database is PGlite in `./.data`, and without Google variables there's no login. `.env.example` lists the optional ones.

## Deploy to Vercel

1. **Import the repo** in Vercel. The defaults work: the `vercel-build` script applies database migrations, then runs `next build`.
2. **Add Postgres.** In the project's Storage tab, add Neon from the Marketplace and connect it. It sets `DATABASE_URL`.
3. **Create a Google OAuth client** in Google Cloud Console (APIs & Services, Credentials, OAuth client ID, type "Web application"). Add the authorized redirect URI `https://<your-domain>/api/auth/callback/google`.
4. **Set the environment variables** below, then redeploy.
5. **Sign in with Google.** Without `ALLOWED_EMAILS`, the first account to sign in owns the install, so sign in right after deploying.
6. **Paste your Adeli API key** on the Setup page. It's checked against Adeli, stored encrypted, and Adeli Chat registers its webhook.
7. **Allowlist the connect redirect.** In Adeli, under Settings, OAuth, add `https://<your-domain>/connect` so you can connect Instagram from Adeli Chat.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Set by the Neon integration. Use the pooled connection string. |
| `BETTER_AUTH_SECRET` | Yes | Random, at least 32 characters: `openssl rand -base64 32`. Also encrypts the saved Adeli key, so keep it stable. |
| `GOOGLE_CLIENT_ID` | Yes | From the Google OAuth client. |
| `GOOGLE_CLIENT_SECRET` | Yes | From the Google OAuth client. |
| `ALLOWED_EMAILS` | No | Comma-separated emails that may sign in. Empty: first sign-in owns the install. |
| `APP_URL` | No | Set it when you use a custom domain. Defaults to the Vercel production domain. |

The Adeli API key and URL aren't environment variables: you enter them in the app, in Setup or Settings. `ADELI_API_KEY` and `ADELI_API_BASE_URL` still work as fallbacks, which is handy locally.

Google sign-in only works on domains registered in the OAuth client, so preview deployments with random URLs can't sign in unless you add them.

To test the whole flow against a local Adeli dev server, with a real comment triggering a real DM, follow [docs/local-development.md](docs/local-development.md).

## Get your Adeli API key

Every install uses its own Adeli key.

1. **Create an Adeli account.** Go to [app.tryadeli.com](https://app.tryadeli.com/sign-in) and sign in with Google. Your first sign-in creates your account and a default profile.
2. **(Optional) Connect Instagram in Adeli.** Open **Accounts** and connect your Instagram Business or Creator account. You can also do this from Adeli Chat.
3. **Create an API key.** Open [API keys](https://app.tryadeli.com/settings/api-keys), label it "Adeli Chat", and click **Create key**.
4. **Copy the key now.** Adeli shows it only once. It starts with `rk_live_`.

Paste it on the Setup page, or later in Settings. Never commit a key.

## Notes

- Follow Meta's Platform Terms and Instagram's messaging policies when you run automations.
- The code is MIT licensed. The Adeli logo in `public/brand/` is used with permission and isn't covered by the MIT license; forks should swap it.
