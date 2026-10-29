# Adeli Chat

Free, open-source Instagram Comment to DM automations (a ManyChat alternative), built on the [Adeli](https://tryadeli.com) API.

When someone comments a keyword on your post, Adeli Chat replies to their comment and sends them a DM with your link.

**Status:** the full Comment to DM flow runs against the Adeli API: a matching comment gets a public reply and an opening DM with a button, and a tap sends the final DM with your link. Automations and their stats live in Postgres, or in a local PGlite database if you don't set one up. See [docs/PRD.md](docs/PRD.md) for the spec and build plan, and [docs/brand.md](docs/brand.md) for the design system.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then set ADELI_API_KEY (see below)
npm run dev
```

Open http://localhost:3030. Nothing is mocked, so you need an Adeli API key. Every Adeli call goes through [`@adeli/sdk`](https://www.npmjs.com/package/@adeli/sdk).

| Variable | Required | Default |
| --- | --- | --- |
| `ADELI_API_KEY` | Yes | |
| `DATABASE_URL` | No | Local PGlite database in `./.data` |
| `ADELI_API_BASE_URL` | No | `https://app.tryadeli.com` |

There's no login. This is a demo of the Adeli API, so run it on your own machine. If you deploy it, anyone who can open the URL can send DMs from your Instagram account.

To test the whole flow against a local Adeli dev server, with a real comment triggering a real DM, follow [docs/local-development.md](docs/local-development.md).

## Get your Adeli API key

Every install uses its own Adeli key.

1. **Create an Adeli account.** Go to [app.tryadeli.com](https://app.tryadeli.com/sign-in) and sign in with Google. Your first sign-in creates your account and a default profile.
2. **(Optional) Connect Instagram in Adeli.** Open **Accounts** and connect your Instagram Business or Creator account. You can also do this from Adeli Chat.
3. **Create an API key.** Open [API keys](https://app.tryadeli.com/settings/api-keys), label it "Adeli Chat", and click **Create key**.
4. **Copy the key now.** Adeli shows it only once. It starts with `rk_live_`.

Set it as `ADELI_API_KEY` in your server environment (`.env.local` locally) and restart. Never commit a key.

## Notes

- Follow Meta's Platform Terms and Instagram's messaging policies when you run automations.
- The code is MIT licensed. The Adeli logo in `public/brand/` is used with permission and isn't covered by the MIT license; forks should swap it.
