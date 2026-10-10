# Decisions

Each entry: what was decided, who decided, and what it replaces in the brief. Planner tests follow this file.

## Eli's decisions

### D1. Wake time and bedtime (2026-10-09)
- Recommended wake = bedtime + 8 hours, never later than 9:00 AM.
- Earlier is better: if bedtime allows, wake at 6:30 AM (ideal bedtime 10:30 PM).
- Wake is also never later than the latest feasible wake for tomorrow's first fixed commitment (see Defaults).
- Bedtime = the later of (ideal bedtime) and (last commitment end + 45 minutes).
- If the 6:30 target can't hold, wake moves later instead of cutting sleep. Sleep under 8 hours only happens when a morning commitment forces it, and then the app shows a warning with the real number of hours.
- The wake time stays editable (Edit wake time on Today) and replans the day.
- Replaces: Part 6 "never later than T" and the 6:30 hard cap.
- Example: Monday flag football ends 10:30 PM, bed 11:15 PM, Tuesday wake 7:15 AM, 8 hours sleep, no early library block.

### D2. Morning routine (2026-10-09, revised 2026-10-09)
- Cold shower at W + 5 for 10 minutes.
- Walk with God starts at W + 15, right after the shower.
- Walk length: 15 minutes by default, 10 minimum when the next fixed item is tight, up to 30 minutes when there is slack before the next fixed item.
- The 10 minute snack (D3) follows the walk.
- No buffers between the shower, the walk and the snack.
- With the default walk, the anchors end at W + 30 and the first block starts about W + 40. It starts later when the walk expands.
- Example, wake 7:30: shower 7:35 to 7:45, walk 7:45 to 8:00, snack 8:00 to 8:10.
- Replaces: Part 5 step 2 (W + 10, 30 minute walk), test 1, and the earlier W + 20 walk.

### D3. Breakfast is a quick grab-and-go snack (2026-10-09)
- 10 minutes, right after the walk: at home if staying home, or picked up on the way or on campus if heading out.
- Lunch is the first real meal.
- Replaces: Part 5 step 4 (20 minute breakfast after the floor).

### D4. Side Hustle Summit floor (2026-10-09, revised 2026-10-09)
- A daily task: 30 minutes of focused work or the set number of outreach calls or DMs. It is placed in a free slot like other work, not in the morning routine.
- It never competes with exam prep. Any school exam or deadline within 7 days outranks it.
- On Code Red, and on any day within the 7 days before an exam, it is cut to a minimal 10 minute outreach version, or dropped entirely when the day is full.
- A late wake or Lost Day can also cut it.
- It is never required for a Win and never causes a Lost Day.
- Replaces: Part 5 step 3, the "protected" wording, and the earlier "same priority as study" wording.

### D5. Tax class and exams (2026-10-09, revised 2026-10-09)
- Eli is enrolled in the Mon/Wed 3:00 to 4:20 PM tax section but attends the Mon/Wed 1:30 to 2:50 PM session and lifts afterward.
- Weekly seed: tax class Mon/Wed 1:30 to 2:50 PM. The 3:00 to 4:20 PM section is used only for midterms.
- Tax Midterm II: Wednesday, November 4, 2026, 3:00 to 4:20 PM, immovable. The 1:30 session is skipped that day and its time is used for review (assumption, Eli will correct if wrong). That day's lift moves to another slot or day.
- Oct 28: Accounting Exam 2 (12:00 PM, immovable) replaces the 12:00 Intermediate Accounting class. Tax stays at 1:30 to 2:50 PM and the lift follows it.
- Replaces: Part 13 "on exam days tax class moves to 3:00 to 4:20 PM", Appendix B tax times (1:30 to 2:55), and the earlier Oct 28 default.

### D6. Code Red has two levels (2026-10-09)
- Church and Epic large group keep running in every Code Red.
- **Code Red** (standard): practices (club, D1, flag football) keep running. Social events, Epic small group, discipleship, workouts, misc and non-school tasks pause. The floor drops to 10 minutes.
- **Code Red: all in** (severe): practices pause too. For bad situations.
- Eli picks the level. The app will suggest "all in" when an exam is 2 days away (Phase 2 UI), and Eli decides.

### D7. Discipleship with Isaac is a weekly "maybe" (2026-10-09)
- No fixed time. Never planned on its own.
- Each Thursday the app asks "Dship with Isaac tomorrow?" with Yes (pick a time) or Not this week. Yes adds a one-time event on Friday. The talk box can also add it.

### D8. Oct 22 Bryson Tiller concert (2026-10-09)
- Blocked from 9:00 AM (leave for LA) through the night. A work session fits before leaving. No workout that day. Meals happen on the trip.
- BUS 3302 (9:00 AM) and Epic large group are skipped that day because of the 9:00 departure. (Assumption: Eli will say if he goes to class first.)
- Dancing with the Stars is 90 minutes.

### D9. Email and password sign-in (2026-10-09)
- Replaces the brief's email magic link. Supabase's free plan cannot edit email templates without a custom email sender, and a magic link opens in Safari instead of the iPhone Home Screen app.
- "Confirm email" is off (single user). New sign-ups are turned off once Eli's account exists.
- Forgot password sends Supabase's standard reset email; the link opens a "New password" screen.

### D10. Evenings are free (2026-10-10)
- No study, work or Side Hustle Summit floor after sunset (computed daily for San Luis Obispo: about 6:35 PM in October, 4:55 PM in December).
- Exception: something due within a day, or school work in Code Red, may run after sunset at the campus library (on campus days) or at home, until the evening wind-down.
- Coffee shops are daytime only as a result.

### D11. Feedback round after Checkpoint 2 (2026-10-10)
- The Big 3 are chosen at the morning check-in (top tasks offered; tap to keep or swap; New task on the spot). The day is built around them.
- The contract is editable before and after signing until Eli taps Lock contract. It stays readable on the Vision page (Home has a Contract link).
- Late-wake cuts (Part 5 step 12) only happen when Eli wakes more than 15 minutes after last night's recommended wake. On an ordinary full day nothing is cut; a warning names any Big 3 item with no time.
- Bed shows "End of the day" instead of a duration.
- Place names are editable. Inputs use 16 px text so iPhone does not zoom.
- Anchor taps play a fill, check and burst animation with a haptic tick (Android vibration; iOS 18 switch haptic). The full visual pass, the contract as a signed document, and optional Higgsfield video assets are Phase 4.

### D12. Talk box (Phase 3, 2026-10-10)
- Models: `claude-sonnet-5-5` for the talk box and Delegate, `claude-haiku-5-5` for the coach line (Edge Function secrets ANTHROPIC_MODEL_PARSE and ANTHROPIC_MODEL_COACH).
- Sonnet 5.5 rejects forced tool_choice, so `submit_ops` is offered with tool_choice auto and the prompt requires it. Strict mode is off for submit_ops because 21 operation shapes exceed strict schema limits. Instead the app checks every reply with the same Zod schema (generated into the tool definition) plus id, time and hard-rule checks, retries once with the errors, then fails without changing anything.
- Server-side refusal fallback is on (`fallbacks: "default"`): if a safety classifier declines, the API reruns the request on a fallback model.
- The system prompt and tool schema are fixed text, so prompt caching makes repeat calls cheaper. Context (date, plan, tasks, events, vision) travels in the user message.
- Operations take times as HH:MM and dates as YYYY-MM-DD. "Delete this block" hides it from the planner for that day (kept across replans). "Move this block" pins it at the new time and the rest of the day is rebuilt around it.
- Undo restores today and the next 7 days of plan, plus settings, tasks, events and quotes, exactly as they were.
- The live-AI dump test is a "Talk box check" button in Settings (5 AI calls, no data changes) instead of a terminal script.
- Coach line: one Haiku call per day, cached. Away 2 or more days: the brief's message plus a 5 minute start. Away 5 or more: a firm message and a Lost Day reset button.
- Decision after 3 deferrals: Do it today (top of the Big 3), Schedule it (sets the date as its deadline), Delegate (AI writes steps and any message draft onto the task), Drop it.

### D13. Look (Phase 4, 2026-10-10)
- Six themes with the brief's exact base colors. Derived colors (text on accent, Half and Loss chips, journey colors, an accent dark enough for small text) are chosen per theme and checked by a contrast test (4.5:1 for text). Three adjustments to reach 4.5:1: Sakura muted #8A6C77 to #836571, Ocean muted #587887 to #537281, Black and Gold Half chip #6F5D1E.
- The theme saves to the account and to the browser (only to paint the right background before the app loads). The account setting wins. Color fades play on a theme switch, never on load.
- Black Panther: chrome (#C9CED6) on thin card edges at low opacity, icons, the ring outline (with a faint metallic gradient) and the signature underline. Forest and Ember: the ember second accent marks streak counters and the Half chip.
- Contract to Self is laid out as a signed document: an opening line ("I, ___, make this agreement with myself on ..."), roman-numbered clauses with symbols, a signature line, and a wax-style seal. Signing: the name is written in a script font (Great Vibes) left to right over 2 seconds, the line draws, the label and date fade in, the seal stamps, it holds, then fades and slides up. Tap skips. Reduced motion: no movement, everything appears at once.
- Symbols: every block type and journey has a line icon (Lucide). Screens settle in with a short staggered fade-up. A day turning into a Win plays a glow on the Home ring and says "That day is a Win."
- Sheets render at the top level of the page so animated cards can never cover them.
- Install hint: an Install button where the browser offers one (Android, desktop Chrome or Edge); on iPhone, "tap Share, then Add to Home Screen". Dismissible once.
- Higgsfield: optional background clips listed in public/media/manifest.json, with prompts and export specs in docs/HIGGSFIELD.md. Nothing renders until a clip is added.

### D14. Notifications (Phase 5, 2026-10-10)
- Web Push with VAPID keys (private key only in the Edge Function secrets). pg_cron calls the send-due function every minute; it is protected by a shared secret kept in the Supabase Vault and the function secrets, not by sign-in.
- Reminders, computed from the saved plan by one shared module (supabase/functions/_shared/reminders.ts) used by both the server and the app:
  - Morning: at last night's recommended wake (or the wake target), unless already checked in with both anchors done.
  - Evening close-out: at the wind-down block (or an hour before bed).
  - Bedtime: at the recommended bedtime.
  - Optional, off by default: 5 minutes before each block (not travel, wind-down, bed, anchors, done or skipped blocks).
- Each reminder is logged once (unique per day and kind) before sending, so it never goes out twice. Expired devices are removed automatically.
- Permission is asked only after tapping Enable. On iPhone outside the Home Screen app, the app explains it must be installed first. When push is blocked or unsupported, the same reminders appear as in-app banners while the app is open, and Settings says so plainly.
- Blooio (iMessage) is not used: Web Push covers iPhone 16.4+ Home Screen apps, Android and desktop.
- The service worker is now our own (src/sw.ts, Workbox precache plus push and notification-click handlers).
- Database migrations now run from Claude's side through the Supabase Management API with the saved access token (no more pasting SQL).

### D15. Daily photo and Memory (Phase 5, 2026-10-10)
- Eli's change: the photo can be taken any time of day, not only at evening close-out. A "Today's photo" card on Home stays open until there is one. The photo reminder goes out at a time Eli picks (default 12:00 PM) and only if today has no photo yet; the evening close-out mentions it if still open.
- One photo per day with a one-line caption (required). The caption box shows one coach question tied to the vision (Haiku, cached per day). Taking another photo the same day replaces it.
- Photos are shrunk on the phone to 1600 px JPEG before upload and stored in a private Supabase Storage bucket under Eli's user id; only his account can read them (short-lived signed links).
- Missed photo: a past day that was checked in but has no photo shows a small grey dot on Week and in the Memory calendar. It never changes the score.
- Memory page: "Then and now" (day 1, day 30, day 90 counted from the first photo, each allowing up to 3 days late, and the latest), a month calendar of thumbnails, and a photo view to edit the caption, mark a milestone (star) or delete. On phones Memory opens from the photo card and Week; on laptops it is also in the sidebar.

### D16. Sunday scouting report (Phase 5, 2026-10-10)
- The week (Monday to Sunday) closes on Sunday when wind-down starts (9:00 PM if there is no wind-down block). From then until Monday night, Home shows "Scouting report is in". Every closed week's report also opens from Week, and the report page steps back through earlier weeks.
- The facts are computed in the app, never by the AI: series record and points, cold shower, walk, Big 3, workouts, Side Hustle Summit floor, photos, late wakes (more than 15 minutes after the recommended wake), best day, and tasks pushed off twice. Sunday is scored live; a day skipped after Eli started counts as a loss; a first, partial week is measured on the days it had.
- The app writes a plain draft from the facts (what held at 85 percent or better, the weakest area, one matching adjustment, a line from the identity statement). Two or more late wakes are named as the slip first. The photo is named as the slip only when everything that counts held, because it never changes the score.
- The coach (Haiku) rewrites the four lines from the facts and the draft, through a tool call; the app validates the reply and strips dashes. The coach version is saved in the reports table; if the coach is unavailable, the plain draft shows and the next open asks again. "Write it again" asks for a new version.
- Sunday's evening reminder becomes "Close the week" and points to the report.

### D17. Same thing, different words; late close-out (Eli's feedback, 2026-10-10)
- Problem seen in Eli's data: Big 3 items "Lift", "Intentional Dinner" and "D Ship Workshop" each got their own work time although they were the workout, dinner and the workshop event; the talk box's "Dinner and intentional hangout" block sat next to a planner dinner; Oct 9 scored a Loss because the workout and dinner were never checked off as Big 3 items.
- One matching rule (src/planner/link.ts) decides when two titles are the same thing: typos and one letter apart, plurals and -ing, the same words in another order or with extras (two or more real words, so "Tax" never matches "Tax class"), and abbreviations ("D Ship" = "Discipleship").
- A task that already is something on the day is linked to that block instead of getting work time: events and manual blocks by title, the workout by words like lift, weights, gym, run, meals by meal words, the Side Hustle Summit floor by outreach words. The block shows a Big 3 tag; checking either the block or the Big 3 item checks both.
- Meals: a block or event whose title names a meal is that meal; the planner adds no second one and says "Dinner is ... at ...".
- No duplicates: creating a task whose title matches an open task reuses it; the talk box skips add_task and add_block duplicates, and its prompt now says to reuse what exists and to name meal blocks with the meal word.
- Planner fix: a workout already done or pinned is kept on replan; the planner no longer places a second workout with the same id over it.
- Late close-out: a past day stays open for check-offs for 7 days. The morning check-in shows "Close out yesterday" when yesterday has an anchor or Big 3 item unchecked, and every past day in Week has "Close out this day". Checking off rescores the day at once. A late Big 3 check counts for that day only (so a habit like "Lift" is not checked off for today); "Finished" closes a one-time task for good.
- Number boxes (task minutes, place drive times) can be empty while typing, open the number pad, and select on focus, so typing 30 gives 30.

### D18. Focus view, the building and the pillars; plans change (Eli, 2026-10-10)
- Today opens on a focus view: a building. The cold shower and the walk are the two foundation steps, six pillars rise with steps toward them, and the Big 3 are the roof beams. When the foundation and the roof are done, it stands: that is the Win (the score itself is unchanged: anchors plus Big 3). Home shows the same building, smaller; tapping it opens Today.
- The six pillars (journeys in the code), in building order: Faith and Epic, Body, Sports, Academics, Side Hustle, Social and Community. Labels can change later in one place (JOURNEYS).
- What raises a pillar: the anchors (cold shower: Body; walk: Faith), Big 3 items and tasks finished that day, by their pillar; showing up counts on its own (classes, practices, events and blocks Eli added count once they end unless skipped); effort blocks (workout, the floor, work) count when checked; and small steps Eli logs by tapping a pillar (with starter ideas per pillar). One step raises a pillar about halfway, two most of the way, three fills it. Each pillar shows its last 7 days and its count over 30 days.
- The schedule below is a guide, not a checklist: only the foundation and the Big 3 decide the Win.
- Kaizen (trial): from 5 PM a card asks for one thing to do 1% better tomorrow; it shows under the next day's building. Eli is not sold on it; easy to remove.
- Plans change: every block on Today has "Cancelled". An event is skipped for that day only (a one-time event is removed), anything else is taken off, and the rest of the day is rebuilt from now; a message says what moved into the freed time.
- Talk box follow-ups: the last messages from today (on this device) go along with each new one, so "that got cancelled" or "it's at 6 now" knows what "that" is. The prompt has rules for cancellations, moves, replacements and lost time; it never fills the gap itself, the planner does. After each message the result card says how the day reshaped.

## Claude's defaults (change any by telling me)

- 5 minute buffers between blocks, except inside the morning routine (D2).
- Drive time ranges are stored as their midpoint. Home is 0 from home. Campus = campus library times (18 minutes from home).
- Latest feasible wake for a morning commitment = its start - drive - 40 (default anchors + snack) - 5 (buffer), rounded down to 5 minutes. For a 9:00 AM class on campus: 7:55 AM.
- Oct 22 (concert): no study or work blocks that day.
- Oct 23 to 25: retreat and day off. Only anchors, meals, and immovable events.
- When a fixed event leaves no room, lunch, dinner, and misc are moved or shortened first, with a note.
- Plain CSS variables, no Tailwind.
- Setup order: the Anthropic API key is created at the start of Phase 3 (first AI use) and VAPID keys at the start of Phase 5 (notifications), so nothing costs money or sits unused before it is needed. Playwright browsers are installed at the start of Phase 2.
- Supabase uses the new publishable key (`sb_publishable_...`) in the client, named `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `vercel.json` rewrites app routes to `index.html` so deep links like `/today` work.

### Planner defaults (Phase 1)

Spacing and places
- A drive replaces the 5 minute buffer: the drive block ends when the next block starts.
- One work place per day: the campus library on class days, otherwise the closest place that is good for the top task (Scout's for deep work, Public Market for easy work). All tasks go there, so there is at most one extra move. Errands are not yet split off to Starbucks or Whole Foods, so the planner never makes a Starbucks block and "a meal before Starbucks" holds by default.
- The Side Hustle Summit floor and the misc block may be at home (outreach and chores are not studying). Study and task blocks are never at home.
- If two fixed events are too close for the drive between them, the app warns ("Expect to join about 8 minutes late"). First case: Nov 4, Tax Midterm II ends 4:20 PM on campus and ITP Zoom starts 4:30 PM at home.

Morning
- The walk is 15 minutes, grows to 30 only when there are at least 90 minutes before the next fixed item, and drops to 10 when under 15 minutes are left.
- The snack is at home right after the walk. No snack is planned if the day starts or restarts after 11:00 AM.

Meals, misc, workouts
- Lunch: 30 minutes between 11:00 AM and 2:30 PM, else 15 minutes squeezed between commitments (a note, not a warning; Monday and Wednesday always need it). Dinner: 30 to 45 minutes between 5:30 and 8:00 PM, else 5:00 to 9:30 PM with a note (Sundays with 6 PM practice).
- Misc: 30 to 45 minutes, preferably after 3:00 PM.
- Workouts: 60 minutes by default, shrinking to 45 when needed, and to 30 only as a late-wake cut. They start right after the last campus class that ends by 4:00 PM (so the Monday and Wednesday lift comes out at 50 minutes before the Zoom class), otherwise from 1:00 PM, and never before the day's first class.
- A missed workout is caught up later in the week, Saturday included.

Tasks and cuts
- Big 3 get the earliest focus slots (the library block first). Each Big 3 item should get at least 60 minutes (or all its time if shorter). If it can't, flexible items are cut in the brief's order (misc and general work, social, workout length, floor length), but only if a cut actually makes room. Otherwise nothing is cut and a warning names the Big 3 item with no time.
- Tasks are split into 25 to 90 minute chunks. If a task already got time today and under 15 minutes are left, the rest is treated as done (estimates are guesses).
- Social events move later the same day, otherwise to the next evening after 5:00 PM. They are never deleted. If they run past the planned week, a warning names them.

Modes and replan
- Code Red keeps meals and a 10 minute floor (see D6 for which events pause).
- Lost Day salvage order: cold shower and walk (if not done), the next meal, the shortest Big 3 item, a 30 minute workout.
- Replan keeps done, in-progress, pinned and manual blocks, plus past meals, events and misc. Missed anchors, work, the floor and workouts are planned again from now.
- A day with an empty Big 3 is a Win when both anchors are done.

Seed assumptions (correct any in Settings later)
- Dancing with the Stars: Tuesday from 9:35 PM, 90 minutes (moves when it doesn't fit). Flex social: Saturday 7:00 to 9:00 PM at home. Discipleship with Isaac: see D7 (default time when confirmed: 1 hour on campus). Epic large group is on campus. One-on-one Epic breakfast: 9:35 to 10:35 AM near church. Church is 15 minutes from home (estimate).
- Practice block B is at Grover only on Wednesday. Tuesday and Sunday B practices are on campus.
- D1 practice, club practice and flag football are not immovable, so Code Red "all in" and Lost Day can pause them. Classes and exams are immovable.
- Trips (rank "trip", top of the ladder) are one-time commitments Eli sets himself, such as the Oct 22 concert.
