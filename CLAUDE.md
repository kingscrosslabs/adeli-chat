# adeli-chat

Open-source ManyChat alternative (Instagram Comment to DM) built on the Adeli API.

- **Spec and build plan:** `docs/PRD.md`. Read it before making changes. Decisions are in §0, milestones in §10.
- **Design and copy:** `docs/brand.md`. Use its tokens and Adeli's copied `components/ui`; no ad hoc colors.
- **Adeli API:** endpoint map in PRD §5.11, missing pieces in §12A. Source of truth is the local `adeli` repo
  (`docs/public-api.md`, `apps/web/app/docs/`).
- **Adeli API key:** never commit one. It comes only from `ADELI_API_KEY`, read only through `src/lib/adeli/key.ts`.
- **Keep it a simple demo:** no login, no stored secrets. `ADELI_API_KEY` is the only required env var; `DATABASE_URL` is optional (falls back to PGlite in `./.data`). See `.env.example`.
- **Copy rule:** no em dashes anywhere (UI text, defaults, docs, commit messages).
- All Instagram calls go through `@adeli/sdk`, wrapped in `src/lib/adeli/`. Nothing else calls Adeli directly.
- Nothing is mocked in the app. Local testing runs against a local Adeli dev server (`docs/local-development.md`). Tests use a fake `fetch` and in-memory PGlite.
