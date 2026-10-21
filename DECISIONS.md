# Decisions

Choices made where the spec was open, per rule 6 in the build prompt.

| # | Phase | Decision | Why |
|---|---|---|---|
| 1 | 0 | Only the customer app uses a route group (`(customer)`); partner, rider and admin are plain folders. | Keeps URLs exactly `/`, `/partner`, `/rider`, `/admin`, and gives each app its own layout. |
| 2 | 0 | Tailwind v4 (what Next 15 ships with) with shadcn/ui components written into `src/components/ui`. Theme tokens live in `globals.css`. | Current shadcn default; tokens give dark mode for free in Phase 10. |
| 3 | 0 | App icons are generated from brand colours by a route (`/icons/[size]`), not static PNGs. | Renaming or recolouring the brand needs no new image files. |
| 4 | 0 | Server layouts pass an app key (`"customer"`, `"rider"`…) to client nav components, which look up their items in `src/config/navigation.ts`. | Icon components can't be passed from Server to Client Components. |
| 5 | 0 | Every nav tab has a real page with an empty state from day one. | No dead links at any phase (checked by a Playwright test). |
| 6 | 0 | The Demo Switcher remembers the persona in `localStorage` and opens its app. Real sign-in as that persona arrives in Phase 2. | Auth doesn't exist until Phase 2. |
| 7 | 0 | Hindi strings will use a small typed dictionary, not an i18n library. | Two languages, demo scope. |
| 8 | 0 | Supabase can't run locally in the build sandbox (no Docker). Migrations and RLS are tested against plain Postgres 16 with a minimal `auth` schema stub; the app itself targets a hosted Supabase project. | Lets Phase 1 checks run without Docker. |
| 9 | 0 | Fonts: Inter (body) and Plus Jakarta Sans (headings) via `next/font`. | Warm, readable, self-hosted at build time. |
