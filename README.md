# Adeli Chat

Free, open-source Instagram Comment to DM automations (a ManyChat alternative), built on the [Adeli](https://tryadeli.com) API.

When someone comments a keyword on your post, Adeli Chat replies to their comment and sends them a DM with your link.

**Status:** frontend preview. Every screen is built and clickable on mock data. The backend (database, Adeli client, webhooks, worker) is next. See [docs/PRD.md](docs/PRD.md) for the spec and build plan, and [docs/brand.md](docs/brand.md) for the design system.

## Run the frontend preview

```bash
npm install
npm run dev
```

Open http://localhost:3000. Data lives in your browser's localStorage, so nothing needs a database or an Adeli key yet.

- Any password logs you in. Type `wrong` to see the error state.
- On the setup screen, **Fill a demo key** gives you a valid-looking key. Keys containing `bad` are rejected, `offline` simulates Adeli being down, and `other` belongs to a different Adeli profile.
- The **Demo** button (bottom right) loads sample automations, resets to a fresh install, simulates a revoked key, and switches to "key set by environment" mode.

## Get your Adeli API key

Every install uses its own Adeli key.

1. **Create an Adeli account.** Go to [app.tryadeli.com](https://app.tryadeli.com/sign-in) and sign in with Google. Your first sign-in creates your account and a default profile.
2. **(Optional) Connect Instagram in Adeli.** Open **Accounts** and connect your Instagram Business or Creator account. You can also do this from Adeli Chat.
3. **Create an API key.** Open [API keys](https://app.tryadeli.com/settings/api-keys), label it "Adeli Chat", and click **Create key**.
4. **Copy the key now.** Adeli shows it only once. It starts with `rk_live_`.

Paste it into the Setup screen, or set `ADELI_API_KEY` on your server to skip that screen. Never commit a key.

## Notes

- Follow Meta's Platform Terms and Instagram's messaging policies when you run automations.
- The code is MIT licensed. The Adeli logo in `public/brand/` is used with permission and isn't covered by the MIT license; forks should swap it.
