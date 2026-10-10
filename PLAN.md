# Alignment: Build Plan

Status (2026-10-10): Phases 0 to 4 done. Phase 5: notifications, photos and Memory, and the Sunday scouting report are done, plus Eli's Oct 10 changes (D17, D18: Big 3 linking, late close-out, the focus view with the building and pillars, plans-changed follow-ups). The urge button and the monthly recap are next.

## 1. Machine check (done 2026-10-09)

| Tool | Version | OK? |
|---|---|---|
| Node | 24.19.0 | Yes (needs 20+) |
| npm | 11.17.0 | Yes |
| git | 2.55.0 | Yes |
| CPU | Windows ARM64 | Yes, with the notes in Risks |

## 2. Stack (as briefed, no changes)

- **App:** TypeScript, React 18, Vite, React Router, Zustand, Zod, date-fns + date-fns-tz.
- **Styling:** plain CSS with CSS variables (one file of theme tokens, `data-theme` on `<html>`). No Tailwind: the theme rules are easier to read and check as plain variables.
- **PWA:** vite-plugin-pwa (manifest, icons, service worker, offline cache of the app shell and today's plan).
- **Backend:** Supabase (Postgres, magic link Auth, Storage, Edge Functions in Deno, pg_cron + pg_net). RLS on every table.
- **AI:** Anthropic API, only from Edge Functions. Models from env vars `ANTHROPIC_MODEL_PARSE` (Sonnet class) and `ANTHROPIC_MODEL_COACH` (Haiku class). Forced tool call `submit_ops` with a strict schema.
- **Hosting:** Vercel (web), Supabase (backend).
- **Push:** Web Push with VAPID, `send-due-notifications` Edge Function, pg_cron every minute via pg_net. Feasible on Supabase free tier, so no alternative needed.
- **Tests:** Vitest (unit), Playwright (end to end), GitHub Actions on every push.
- **Time:** all schedule logic in America/Los_Angeles. A block is `date` (YYYY-MM-DD) + `start_min` / `end_min` (minutes from midnight). The only place a real clock is read is one `nowLocal()` helper, so tests can freeze time.

## 3. Folder layout

```
alignment/
  PLAN.md  DECISIONS.md  README.md  .env.example
  src/
    planner/            pure TypeScript, no imports from app, db, or network
      types.ts          PlanInput, Block, Task, Event, Place, Settings, Mode
      time.ts           minutes helpers, ceil5, LA date helpers
      priority.ts       urgency, score, big3 pick
      bedtime.ts        bedtime + wake recommendation
      expand.ts         weekly + one-time events -> events for a date
      slots.ts          free-slot math, overlap checks
      planDay.ts        steps 1 to 13
      planWeek.ts       7 days with carry-forward
      replan.ts         replan(now)
      diff.ts           added / moved / resized / removed
      scoring.ts        Win / Half / Loss, weekly series, streaks
      __tests__/        one file per Part 14 case group + fixtures/eli-week.ts
    ops/                talk box operations
      schema.ts         Zod schemas for every op
      validate.ts       ids exist, times valid, hard rules
      apply.ts          ops -> row changes (pure), snapshot, undo
      describe.ts       ops -> "Wake time set to 7:30 AM." lines
    speech/useSpeech.ts mic hook (Part 8 step 10)
    data/               Supabase client, repositories, Zustand stores
    ui/                 components (Ring, Chip, Card, Timeline, TalkBox, ...)
    screens/            Contract, CheckIn, Home, Today, Week, Quotes, Settings, later Memory, Recap
    theme/              tokens.css, themes.ts, pre-paint script
    copy/               every user-facing string + a test that bans em dashes and emoji
  supabase/
    migrations/         SQL schema, RLS, cron jobs
    seed/               seed.ts reading seed/*.json (idempotent upserts)
    functions/          parse-dump, coach-line, delegate, send-due-notifications, weekly-report
  e2e/                  Playwright specs 20 to 25 + dump specs with mocked AI
  scripts/live-dump-test.ts   the one-time live-AI script for Checkpoint 3
  .github/workflows/ci.yml
```

The planner folder imports nothing outside itself. That keeps it pure, testable, and reusable in a later Capacitor or Tauri wrapper.

## 4. Data model

Exactly the tables in Part 4 of the brief, each with `user_id uuid references auth.users` and an RLS policy `user_id = auth.uid()` for select, insert, update, delete. Additions I will make:

- `day_records`, `blocks`: primary keys `(user_id, date)` and `(user_id, id)`; index on `blocks(user_id, date)`.
- `tasks.journey` and `events.rank_key` are Postgres enums matching the brief lists.
- `events.date_overrides` is not added. Instead, exam-day tax class changes are one-time events plus a `skip_dates` array on the weekly event. Simpler and visible in Settings.
- `settings.last_open_date` for the "away 2 days / 5 days" coach messages.
- `coach_cache(date, kind, text)` for the cached Home line.

Seed data lives in `supabase/seed/*.json` taken word for word from the appendices. App logic never contains seed text.

## 5. How the core works

1. **Planner** builds every schedule. Same input, same output. Block ids are `date:kind:ref`.
2. **AI** only turns words into operations. The client validates them with Zod, retries once with the errors, then applies them as plain data changes.
3. After any change, the client runs the planner for affected days (today plus up to 7), saves blocks, and the stores update Today and Week at once.
4. **Undo** restores a snapshot of every touched row, stored in `ops_log`.
5. **Replan** is the planner alone, no AI, no network needed.

## 6. Milestones (Part 12)

| Phase | What | Checkpoint shows you |
|---|---|---|
| 0 | Accounts (one at a time), repo, Vite + PWA shell, Supabase + Vercel wired | A "hello" URL that installs on your phone |
| 1 | Planner, priority, bedtime, diff, scoring + tests 1 to 12 | Passing Vitest output |
| 2 | Auth, schema, RLS, seed, Contract, Check-in, Home, Today, Week, Settings (Gold and Cream) | The app on your phone and laptop |
| 3 | parse-dump, validation, apply/undo, result card, mic fix, Quotes + tests 13 to 19, 25 | You run the live dump script |
| 4 | Six themes, picker, signing animation, desktop polish, install flow | Theme and signing demo |
| 5 | Notifications, photos + Memory, Sunday report, urge button, monthly recap | 5 then 5b per item |
| 6 | Offline today, error log, DB backups, README, accessibility pass | Final review |

## 7. Risks and how I handle them

1. **Voice on iPhone home-screen apps.** Safari's speech recognition is unreliable inside installed home-screen apps on some iOS versions. If it fails there, the mic button hides and the keyboard's own dictation key (which works everywhere) is the path. Typing always works. I will test on your phone at Checkpoint 3.
2. **Windows ARM64.** Playwright browsers and the Supabase CLI have had gaps on Windows ARM64. Fallbacks: run Playwright in GitHub Actions (Linux) if local install fails, and install the Supabase CLI from its release binary instead of npm.
3. **npm 11 blocks install scripts** (seen on this machine before). Some packages need them. I will approve only the specific packages that need it, in package.json, and note each one in DECISIONS.md.
4. **Supabase free projects pause after about a week without activity.** The every-minute cron should keep it active, but if it pauses, the app shows a plain message and the README has the one-click resume step.
5. **Planner rule conflicts** in the brief (see section 8). Unresolved conflicts are the main way the old app failed, so I need your answers before Phase 1.
6. **AI cost.** One Sonnet call per dump (about 1 to 2 cents), cached Haiku coach lines. Well under a 10 dollar cap.
7. **Clock and time zone bugs.** Handled by the single `nowLocal()` helper and a test run with the machine time zone forced to UTC.

## 8. Decisions

Approved 2026-10-09. [DECISIONS.md](DECISIONS.md) is the source of truth and overrides Part 5 steps 2 to 4, Part 6, Part 13 and test 1 of the brief where they conflict.
