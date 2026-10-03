# adeli-chat

Open-source ManyChat alternative (Instagram Comment to DM) built on the Adeli API.

- **Spec and build plan:** `docs/PRD.md`. Read it before making changes. Decisions are in §0, milestones in §10.
- **Design and copy:** `docs/brand.md`. Use its tokens and Adeli's copied `components/ui`; no ad hoc colors.
- **Adeli API:** endpoint map in PRD §5.11, missing pieces in §12A. Source of truth is the local `adeli` repo
  (`docs/public-api.md`, `apps/web/app/docs/`).
- **Adeli API key:** never commit one. Read it only through `src/lib/adeli/key.ts` (env first, then encrypted DB).
- **Copy rule:** no em dashes anywhere (UI text, defaults, docs, commit messages).
- All Instagram calls go through `src/lib/adeli/` (typed client). Nothing else calls Adeli directly.
- Keep `ADELI_MOCK=1` working so contributors can run the app without Instagram.
