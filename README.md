# Alignment

Eli's daily operating system. An installable web app (PWA) for iPhone, Android and desktop.

- [PLAN.md](PLAN.md): stack, layout, data model, milestones, risks.
- [DECISIONS.md](DECISIONS.md): planner rules and every decision that changes the original brief.

## Setup

1. Install Node 20 or newer and git.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the client values (Supabase URL, anon key, VAPID public key).

## Run

- `npm run dev` starts the app at http://localhost:5173 (needs `.env.local` and a sign-in).
- `npm run dev:e2e` starts it in local test mode at http://localhost:5174: no sign-in, data stays in that browser. To freeze the clock, run `localStorage.setItem('alignment.fakeNow', '2026-10-12T07:45')` in the browser console and reload.
- `npm run build` then `npm run preview` serves the production build at http://localhost:4173.

## Test

- `npm test` runs the unit tests (Vitest).
- `npm run test:coverage` also checks the planner stays fully tested (fails the run if coverage drops).
- `npx playwright test` runs the end-to-end tests on a phone and a laptop screen size (first time: `npx playwright install chromium`).
- To see a whole seeded week as text, in PowerShell: `$env:PRINT='1'; npx vitest run week.print --silent=false`

The planner lives in `src/planner/`. It is pure TypeScript: no network, no database, no clock. Its rules are constants in `src/planner/rules.ts`, and every decision that changes the original brief is in DECISIONS.md. Seed data (schedule, places, settings) is in `seed/`.

## Deploy

- **Web app:** pushing to `main` on GitHub deploys to Vercel automatically.
- **Database changes:** new files in `supabase/migrations/` are run once in the Supabase SQL Editor (paste and Run).
- **AI functions** (`supabase/functions/`): the Supabase access token is saved as the Windows user variable `SUPABASE_ACCESS_TOKEN`. In PowerShell:
  `$env:SUPABASE_ACCESS_TOKEN = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User'); npx.cmd supabase functions deploy parse-dump --project-ref rmuknpoaqjsdtpcwjblj --use-api`
  (same for `coach` and `delegate`). After changing `src/ops/schema.ts`, run `npm run gen:schema` first.
- **Secrets** (Supabase dashboard, Edge Functions, Secrets): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_PARSE`, `ANTHROPIC_MODEL_COACH`.

## Talk box

Words go to the `parse-dump` function, which asks Claude for operations. The app checks every operation (shape, ids, times, hard rules), retries once with the errors, then applies them, replans, and logs the change for Undo. To test the live AI: Settings, Talk box check.
