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
- Code Red keeps meals and a 10 minute floor. It pauses workouts, misc, practices, Epic small group, social events and discipleship. Church and Epic large group are seeded as not paused by Code Red: tell me if that is wrong.
- Lost Day salvage order: cold shower and walk (if not done), the next meal, the shortest Big 3 item, a 30 minute workout.
- Replan keeps done, in-progress, pinned and manual blocks, plus past meals, events and misc. Missed anchors, work, the floor and workouts are planned again from now.
- A day with an empty Big 3 is a Win when both anchors are done.

Seed assumptions (correct any in Settings later)
- Dancing with the Stars: Tuesday 9:35 to 10:35 PM, 60 minutes. Flex social: Saturday 7:00 to 9:00 PM at home. Discipleship with Isaac: Friday 9:00 to 10:00 AM on campus. Epic large group is on campus. One-on-one Epic breakfast: 9:35 to 10:35 AM near church. Church is 15 minutes from home (estimate).
- Practice block B is at Grover only on Wednesday. Tuesday and Sunday B practices are on campus.
- D1 practice, club practice and flag football are not immovable, so Code Red and Lost Day can pause them. Classes and exams are immovable.
- Oct 22 concert is an all-day "no work" marker. Epic large group still shows that evening: delete it or tell the talk box if you will be in LA.
