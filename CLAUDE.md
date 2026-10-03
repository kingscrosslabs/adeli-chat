# adeli-chat

Open-source ManyChat alternative (Instagram Comment to DM) built on the Adeli API.

- **Spec and build plan:** `docs/PRD.md`. Read it before making changes. Decisions are in §0, milestones in §10.
- **First task when working locally:** resolve `docs/PRD.md` §12 using the local Adeli repos
  (Adeli API docs/routes and the landing-page design system), update the PRD, then start M0.
- **Copy rule:** no em dashes anywhere (UI text, defaults, docs, commit messages).
- All Instagram calls go through `src/lib/adeli/` (typed client). Nothing else calls Adeli directly.
- Keep `ADELI_MOCK=1` working so contributors can run the app without Instagram.
