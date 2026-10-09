# Alignment

Eli's daily operating system. An installable web app (PWA) for iPhone, Android and desktop.

- [PLAN.md](PLAN.md): stack, layout, data model, milestones, risks.
- [DECISIONS.md](DECISIONS.md): planner rules and every decision that changes the original brief.

## Setup

1. Install Node 20 or newer and git.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the client values (Supabase URL, anon key, VAPID public key).

## Run

- `npm run dev` starts the app at http://localhost:5173.
- `npm run build` then `npm run preview` serves the production build at http://localhost:4173.

## Test

- `npm test` runs the unit tests (Vitest).

## Deploy

Pushing to `main` on GitHub deploys to Vercel automatically (set up in Phase 0).
