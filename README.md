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

Pushing to `main` on GitHub deploys to Vercel automatically (set up in Phase 0).
