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
