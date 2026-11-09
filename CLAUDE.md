# adeli-chat

Open-source ManyChat alternative (Instagram Comment to DM) built on the Adeli API.

- **Spec and build plan:** `docs/PRD.md`. Read it before making changes. Decisions are in §0, milestones in §10.
- **Design and copy:** `docs/brand.md`. Use its tokens and Adeli's copied `components/ui`; no ad hoc colors.
- **Adeli API:** endpoint map in PRD §5.11, missing pieces in §12A. Source of truth is the local `adeli` repo
  (`docs/public-api.md`, `apps/web/app/docs/`).
- **Adeli API key:** never commit one. Each user enters their own in the app; it's stored encrypted in `user_settings` (`src/lib/secret-box.ts`). `ADELI_API_KEY` is a fallback only for the no-login `local` user. Read it only through `src/lib/adeli/key.ts`; never send it to the browser.
- **Every user has their own workspace:** Adeli key and URL, Instagram account, automations, runs and webhook (`/api/webhooks/adeli/<userId>`). Server code gets the user from `src/lib/auth/session.ts` and passes `userId` down; `adeliCall(userId, ...)` always uses that user's key. Reach automations only through the user's own account (`getConnectedAccount(userId)`).
- **Deploys to Vercel:** Google sign-in via Better Auth (`src/lib/auth/`), required when deployed, off locally without Google env vars. `DATABASE_URL` is required on Vercel and optional locally (falls back to PGlite in `./.data`). See `.env.example` and README "Deploy to Vercel".
- **MCP server:** `/mcp` (`src/lib/mcp/`). Tools call `src/lib/automations/service.ts`, the same code as the Server Actions; never write automations from MCP code directly. Auth is an API token (`adc_`, hashed in `api_tokens`) or an OAuth access token from Better Auth's `mcp()` plugin (`src/lib/auth/server.ts`).
- **Copy rule:** no em dashes anywhere (UI text, defaults, docs, commit messages).
- All Instagram calls go through `@adeli/sdk`, wrapped in `src/lib/adeli/`. Nothing else calls Adeli directly.
- Nothing is mocked in the app. Local testing runs against a local Adeli dev server (`docs/local-development.md`). Tests use a fake `fetch` and in-memory PGlite.
