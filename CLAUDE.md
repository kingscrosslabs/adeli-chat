# adeli-chat

Open-source ManyChat alternative (Instagram Comment to DM) built on the Adeli API.

- **Spec and build plan:** `docs/PRD.md`. Read it before making changes. Decisions are in §0, milestones in §10.
- **Design and copy:** `docs/brand.md`. Use its tokens and Adeli's copied `components/ui`; no ad hoc colors.
- **Adeli API:** endpoint map in PRD §5.11, missing pieces in §12A. Source of truth is the local `adeli` repo
  (`docs/public-api.md`, `apps/web/app/docs/`).
- **Adeli API key:** never commit one. It's entered in the app and stored encrypted in `app_settings` (`src/lib/secret-box.ts`), with `ADELI_API_KEY` as a local fallback. Read it only through `src/lib/adeli/key.ts`; never send it to the browser.
- **Deploys to Vercel:** Google sign-in via Better Auth (`src/lib/auth/`), required when deployed, off locally without Google env vars. `DATABASE_URL` is required on Vercel and optional locally (falls back to PGlite in `./.data`). See `.env.example` and README "Deploy to Vercel".
- **Copy rule:** no em dashes anywhere (UI text, defaults, docs, commit messages).
- All Instagram calls go through `@adeli/sdk`, wrapped in `src/lib/adeli/`. Nothing else calls Adeli directly.
- Nothing is mocked in the app. Local testing runs against a local Adeli dev server (`docs/local-development.md`). Tests use a fake `fetch` and in-memory PGlite.
