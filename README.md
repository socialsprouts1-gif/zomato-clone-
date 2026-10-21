# Thaali

A demo-ready food delivery and dining platform: customer app, restaurant partner app, rider app and admin console in one Next.js app.

> The product name lives in `src/config/brand.ts`. Change it there to rename everything.

| App | URL |
|---|---|
| Customer | `/` |
| Restaurant partner | `/partner` |
| Rider | `/rider` |
| Admin | `/admin` |

## Setup

```bash
pnpm install
cp .env.example .env.local      # fill in Supabase (and later Razorpay) keys
pnpm dev                        # http://localhost:3000
```

The app runs without Supabase keys during Phase 0. Database setup and seeding are added in Phase 1.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Playwright tests (builds must exist; starts `pnpm start` automatically) |
| `pnpm check` | typecheck + lint + build |

If Playwright's bundled Chromium isn't installed, point it at another one:
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e`.

## Demo accounts

Created by the seed script (Phase 1). Password for all: `Demo@1234`.

`customer@demo.in` · `owner@demo.in` · `owner2@demo.in` · `owner3@demo.in` · `rider@demo.in` · `admin@demo.in`

With `NEXT_PUBLIC_DEMO_MODE=true`, the **Demo** button (bottom-left) switches between them.

## Project layout

```
src/
  app/(customer)/   customer app (route group, served at /)
  app/partner/      restaurant partner app
  app/rider/        rider app
  app/admin/        admin console
  components/ui/    shadcn/ui primitives
  components/       shared, layout and demo components
  config/           brand, navigation, demo personas
  lib/supabase/     server, browser and middleware clients
supabase/migrations SQL migrations (Phase 1)
e2e/                Playwright tests
```

## 2-minute demo script

Written in Phase 11, once the full order flow exists.
