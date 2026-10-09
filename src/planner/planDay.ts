// planDay: builds one day's blocks. Pure and deterministic.
// Order (Part 5 as changed by DECISIONS.md): fixed events, bedtime and evening, morning anchors and snack,
// discipleship, library before class, workout and shower, meals, social events, tasks (Big 3 first),
// Side Hustle Summit floor, misc, the rest of the tasks, then drive blocks.
// When the day is too full for the Big 3, the floor or the workout, flexible items are cut in the
// order of Part 5 step 12 and each cut becomes a warning.
import { computeBedtime } from './bedtime';
import { isFlexibleEvent, pausedByCodeRed } from './expand';
import { onCampus, placeName, travel, workPlace } from './places';
import { isSchoolUrgent, rankTasks } from './priority';
import { RULES } from './rules';
import { ceil5, fmtDuration, fmtTime } from './time';
import { HOME, Timeline, type Spacing } from './timeline';
import type { Block, BlockKind, DayInput, DayPlan, EventInstance, Task, WorkoutType } from './types';

/** Cut levels for a day that is too full. Each level includes the ones before it. */
export const CUT = { none: 0, miscAndGeneral: 1, social: 2, workout: 3, floor: 4 } as const;

interface Built {
  plan: DayPlan;
  /** Something protected (Big 3, floor, workout) did not fit, so a deeper cut level may help. */
  unmet: boolean;
}

/** Cuts are only applied when they make room: the lowest level that fits everything protected wins. */
export function planDay(input: DayInput): DayPlan {
  const base = buildDay(input, CUT.none);
  if (input.mode === 'lostDay' || !base.unmet) return base.plan;
  for (let level = CUT.miscAndGeneral; level <= CUT.floor; level++) {
    const built = buildDay(input, level);
    if (!built.unmet) return built.plan;
  }
  return base.plan;
}

const isClass = (e: EventInstance) => e.kind === 'class' || e.kind === 'exam';

function eventBlockKind(e: EventInstance): BlockKind {
  if (isClass(e)) return 'class';
  if (e.kind === 'practice') return 'practice';
  return 'event';
}

function buildDay(input: DayInput, level: number): Built {
  const { date, places, settings, mode } = input;
  const W = input.wakeMin;
  const ws = Math.max(W, input.now != null ? ceil5(input.now) : W);
  const warnings: string[] = [];
  const notes: string[] = [];
  const cuts: { level: number; text: string }[] = [];
  const late = W > settings.wakeTargetMin;
  const cutPrefix = late ? `Late start at ${fmtTime(W)}. ` : 'Tight day. ';
  const tl = new Timeline(places, ws);

  const mk =
    (kind: BlockKind, ref: string, title: string, placeId: string, extra: Partial<Block> = {}) =>
    (start: number, len: number): Block => ({
      id: `${date}:${kind}:${ref}`,
      date,
      start,
      end: start + len,
      kind,
      title,
      placeId,
      taskId: null,
      eventId: null,
      status: 'planned',
      pinned: false,
      source: 'planner',
      howto: null,
      ...extra,
    });

  /** Earliest fit across several candidate places (ties go to the earlier place in the list). */
  const bestFlex = (
    makeAt: (loc: string) => (start: number, len: number) => Block,
    locs: string[],
    minLen: number,
    maxLen: number,
    lo: number,
    hi: number,
    s: Spacing = {},
  ): { start: number; len: number; loc: string } | null => {
    let best: { start: number; len: number; loc: string } | null = null;
    for (const loc of [...new Set(locs)]) {
      const r = tl.findFlex(makeAt(loc), minLen, maxLen, lo, hi, s);
      if (r && (!best || r.start < best.start)) best = { ...r, loc };
    }
    return best;
  };

  // Pinned blocks (done, in progress, manual, or kept by replan) stay exactly where they are.
  for (const b of input.pinned) tl.add(b);
  const pinnedIds = new Set(input.pinned.map((b) => b.id));

  const remaining: Record<string, number> = {};
  for (const t of input.tasks) remaining[t.id] = input.remaining?.[t.id] ?? t.estimatedMinutes;
  for (const b of input.pinned) {
    if (b.taskId && remaining[b.taskId] !== undefined) remaining[b.taskId] = Math.max(0, remaining[b.taskId]! - (b.end - b.start));
  }
  const placedToday: Record<string, number> = {};
  const startRemaining = { ...remaining };

  // 1. Fixed layer.
  const allDay = input.events.filter((e) => e.allDay);
  const noWorkEvent = allDay.find((e) => e.noWork);
  const awayEvent = allDay.find((e) => e.away);
  const carryEvents: EventInstance[] = [];
  let timed = input.events.filter((e) => !e.allDay);

  if (mode === 'codeRed') {
    const paused = timed.filter((e) => pausedByCodeRed(e, input.codeRedLevel));
    timed = timed.filter((e) => !paused.includes(e));
    if (paused.length) notes.push(`Paused by Code Red: ${paused.map((e) => e.title).join(', ')}.`);
  } else if (mode === 'lostDay') {
    const dropped = timed.filter((e) => !e.immovable && !pinnedIds.has(eventId(date, e)));
    timed = timed.filter((e) => !dropped.includes(e));
    if (dropped.length) notes.push(`Lost Day: ${dropped.map((e) => e.title).join(', ')} dropped for today.`);
  }
  if (awayEvent) {
    const off = timed.filter((e) => !e.immovable);
    for (const e of off) {
      if (isFlexibleEvent(e)) carryEvents.push(e);
      else notes.push(`${e.title} is off today: ${awayEvent.title}.`);
    }
    timed = timed.filter((e) => e.immovable);
  }
  const missed = timed.filter((e) => e.end <= W && !pinnedIds.has(eventId(date, e)));
  for (const e of missed) notes.push(`${e.title} at ${fmtTime(e.start)} was before your wake time.`);
  timed = timed.filter((e) => !missed.includes(e));

  const byRank = (a: EventInstance, b: EventInstance) => a.rank - b.rank || a.start - b.start || (a.id < b.id ? -1 : 1);
  const placedEvents: EventInstance[] = [];
  for (const e of timed.filter((x) => !isFlexibleEvent(x)).sort(byRank)) {
    const id = eventId(date, e);
    if (pinnedIds.has(id)) {
      placedEvents.push(e);
      continue;
    }
    const clash = tl.overlapping(e.start, e.end);
    if (clash) {
      warnings.push(`${e.title} overlaps ${clash.title} and was dropped for today.`);
      continue;
    }
    placedEvents.push(e);
    tl.add(eventBlock(date, e));
  }

  // Fixed events too close together for the drive between them.
  const inOrder = [...placedEvents].sort((a, b) => a.start - b.start);
  for (let i = 1; i < inOrder.length; i++) {
    const a = inOrder[i - 1]!;
    const b = inOrder[i]!;
    const t = travel(places, a.location, b.location);
    const gap = b.start - a.end;
    if (t > 0 && gap < t) {
      warnings.push(
        `Only ${Math.max(0, gap)} minutes between ${a.title} and ${b.title}, and the drive takes ${t}. Expect to join ${b.title} about ${t - Math.max(0, gap)} minutes late.`,
      );
    }
  }

  // 11. Evening: bedtime, wind-down, bed.
  const last = [...placedEvents].sort((a, b) => b.end - a.end || (a.id < b.id ? -1 : 1))[0];
  const tf = input.tomorrowFirst;
  const bedtime = computeBedtime({
    lastCommitmentEnd: last ? last.end : null,
    tomorrowFirst: tf ? { start: tf.start, travel: travel(places, HOME, tf.location), title: tf.title } : null,
    wakeTargetMin: settings.wakeTargetMin,
    sleepHours: settings.sleepHours,
    latestWakeMin: settings.latestWakeMin,
  });
  if (bedtime.warning) warnings.push(bedtime.warning);
  const arriveHome = last ? last.end + travel(places, last.location, HOME) : 0;
  const winddownStart = Math.min(1440, ceil5(Math.max(bedtime.bedMin - RULES.winddownMin, arriveHome)));
  const dayEnd = Math.max(ws, winddownStart);
  const evening = mk('winddown', '1', 'Wind down', HOME);
  if (winddownStart < Math.min(bedtime.bedMin, 1440) && !pinnedIds.has(evening(0, 0).id)) {
    tl.add(evening(winddownStart, Math.min(bedtime.bedMin, 1440) - winddownStart));
  }
  const bed = mk('bed', '1', 'Bed', HOME);
  if (bedtime.bedMin < 1440 && !pinnedIds.has(bed(0, 0).id)) tl.add(bed(bedtime.bedMin, 1440 - bedtime.bedMin));

  // 2. Anchors from W only (D2).
  const showerMk = mk('anchor_cold_shower', '1', 'Cold shower', HOME);
  const walkMk = mk('anchor_walk', '1', 'Walk with God', HOME);
  const snackMk = mk('breakfast', '1', 'Grab-and-go snack', HOME);
  let cursor = W + RULES.coldShowerOffset;

  const showerId = showerMk(0, 0).id;
  if (pinnedIds.has(showerId)) {
    cursor = tl.get(showerId)!.end;
  } else if (input.anchors.coldShower.done) {
    const s = input.anchors.coldShower.startMin ?? W + RULES.coldShowerOffset;
    tl.add({ ...showerMk(s, RULES.coldShowerMin), status: 'done' }, { chainAfter: true });
    cursor = s + RULES.coldShowerMin;
  } else {
    const s = tl.find(showerMk, RULES.coldShowerMin, Math.max(cursor, ws), dayEnd, { chainAfter: true });
    if (s === null) warnings.push('No room for the cold shower today.');
    else {
      tl.add(showerMk(s, RULES.coldShowerMin), { chainAfter: true });
      cursor = s + RULES.coldShowerMin;
    }
  }

  const walkId = walkMk(0, 0).id;
  const snackWanted = Math.max(cursor, ws) < RULES.snackLatest && !pinnedIds.has(snackMk(0, 0).id) && mode !== 'lostDay';
  if (pinnedIds.has(walkId)) {
    cursor = tl.get(walkId)!.end;
  } else if (input.anchors.walk.done) {
    const s = input.anchors.walk.startMin ?? cursor;
    tl.add({ ...walkMk(s, RULES.walkDefault), status: 'done' }, { chainAfter: true });
    cursor = s + RULES.walkDefault;
  } else {
    const s0 = Math.max(cursor, ws);
    const next = tl.blocks.find((b) => b.start >= s0);
    let len: number = RULES.walkMax;
    if (next) {
      const snack = snackWanted ? RULES.snackMin : 0;
      const t = travel(places, HOME, next.placeId ?? HOME);
      const avail = next.start - (t > 0 ? t : RULES.bufferMin) - snack - s0;
      len =
        avail >= RULES.walkDefault
          ? Math.min(RULES.walkMax, Math.max(RULES.walkDefault, Math.floor((avail - RULES.walkSlack) / 5) * 5))
          : RULES.walkMin;
    }
    const s = tl.find(walkMk, len, s0, dayEnd, { chainAfter: true });
    if (s === null) warnings.push('No room for the walk with God today.');
    else {
      tl.add(walkMk(s, len), { chainAfter: true });
      cursor = s + len;
    }
  }

  // Snack right after the walk (D3).
  let morningEnd = Math.max(cursor, ws);
  if (snackWanted) {
    const s = tl.find(snackMk, RULES.snackMin, morningEnd, Math.min(dayEnd, RULES.snackLatest + RULES.snackMin));
    if (s !== null) {
      tl.add(snackMk(s, RULES.snackMin));
      morningEnd = s + RULES.snackMin;
    }
  }

  const noWork = !!noWorkEvent;
  if (noWorkEvent) notes.push(`No work planned today: ${noWorkEvent.title}.`);

  // Flexible events. Discipleship goes in now (it ranks above workouts); social goes in after meals.
  const flexible = timed.filter(isFlexibleEvent).sort(byRank);
  const placeFlexible = (e: EventInstance) => {
    const id = eventId(date, e);
    if (pinnedIds.has(id)) return;
    const len = e.end - e.start;
    const make = (start: number, l: number): Block => ({ ...eventBlock(date, e), start, end: start + l });
    if (e.start >= ws && e.end <= dayEnd && tl.canPlace(make(e.start, len)) && !e.movedFrom) {
      tl.add(make(e.start, len));
      return;
    }
    const earliest = e.rankKey === 'social' ? 1020 : ws;
    const s = e.movedFrom
      ? tl.find(make, len, Math.max(ws, earliest), dayEnd)
      : (tl.find(make, len, Math.max(ws, e.start), dayEnd) ?? (e.rankKey === 'social' ? null : tl.find(make, len, ws, dayEnd)));
    if (s !== null) {
      tl.add(make(s, len));
      if (s !== e.start) notes.push(`${e.title} moved to ${fmtTime(s)}.`);
    } else {
      carryEvents.push(e);
      notes.push(`${e.title} did not fit today and moves to the next day.`);
    }
  };
  for (const e of flexible.filter((x) => x.rankKey !== 'social')) placeFlexible(e);

  // Work place for the day (one move per day: all work goes to one place).
  const campusDay = placedEvents.some((e) => isClass(e) && onCampus(places, e.location));
  let pool = input.tasks.filter((t) => (remaining[t.id] ?? 0) > 0);
  const belowTheLine: DayPlan['belowTheLine'] = [];
  if (mode === 'codeRed') {
    for (const t of pool.filter((x) => x.journey !== 'school')) {
      belowTheLine.push({ taskId: t.id, title: t.title, minutes: remaining[t.id]!, reason: 'Paused by Code Red.' });
    }
    pool = pool.filter((t) => t.journey === 'school');
  }
  const ranked = rankTasks(pool, date);
  const big3 = input.big3.map((id) => pool.find((t) => t.id === id)).filter((t): t is Task => !!t);
  const schoolUrgent = ranked.filter((t) => !big3.includes(t) && isSchoolUrgent(t, date));
  const rest = ranked.filter((t) => !big3.includes(t) && !schoolUrgent.includes(t));
  const queue = [...big3, ...schoolUrgent, ...rest];
  const workLoc = workPlace(places, queue[0]?.workType ?? 'deep', campusDay);
  const working = !noWork && mode !== 'lostDay';

  // 8. Library before the first class-day commitment.
  let libraryWindow: { start: number; end: number } | null = null;
  const libWin = mk('library_work', 'window', 'Library work', 'library');
  if (working && placedEvents.some(isClass)) {
    const first = placedEvents.filter((e) => e.start >= morningEnd).sort((a, b) => a.start - b.start)[0];
    if (first && onCampus(places, first.location)) {
      const hi = first.start - (first.kind === 'practice' ? RULES.practicePrep : RULES.bufferMin);
      const s = tl.find(libWin, RULES.libraryMin, morningEnd, hi);
      if (s !== null && tl.canPlace(libWin(s, hi - s))) {
        libraryWindow = { start: s, end: hi };
        tl.add(libWin(s, hi - s));
      } else {
        const s5 = tl.find(libWin, 5, morningEnd, hi);
        const avail = s5 === null ? 0 : hi - s5;
        notes.push(
          `No library block before ${first.title}: only ${avail} minutes left after the morning routine and the drive. It needs ${RULES.libraryMin}.`,
        );
      }
    }
  }

  // 7. Workout and the home shower after it.
  let workoutPlaced: WorkoutType | null = null;
  let workoutLen = 0;
  let workoutUnmet = false;
  const trip = placedEvents.find((e) => e.rankKey === 'trip');
  if (trip && input.workout) notes.push(`No workout today: ${trip.title}.`);
  if (input.workout && mode === 'normal' && !noWork && !trip) {
    const type = input.workout;
    const wMk = mk('workout', type, type === 'field' ? 'Field session' : 'Weights at the rec', 'campus');
    const shMk = mk('shower', '1', 'Shower at home', HOME);
    const classes = placedEvents.filter((e) => isClass(e) && onCampus(places, e.location));
    const firstClassEnd = classes.length ? Math.min(...classes.map((c) => c.end)) : null;
    const afterClasses = classes.filter((c) => c.end <= 960).map((c) => c.end);
    const anchorEnd = afterClasses.length ? Math.max(...afterClasses) : null;
    const notBefore = Math.max(morningEnd, firstClassEnd ?? 0);
    const ranges: [number, number][] = [];
    if (anchorEnd !== null) ranges.push([anchorEnd, anchorEnd + RULES.workout.nearClass + RULES.bufferMin]);
    ranges.push([Math.max(RULES.workout.preferFrom, notBefore), dayEnd]);
    ranges.push([notBefore, dayEnd]);
    const lens =
      level >= CUT.workout ? [RULES.workout.min] : lengthsDown(RULES.workout.default, RULES.workout.shrinkFloor);
    outer: for (const [lo, hi] of ranges) {
      for (const len of lens) {
        for (let s = ceil5(Math.max(lo, ws)); s <= hi && s + len <= dayEnd; s += 5) {
          const w = wMk(s, len);
          if (!tl.canPlace(w)) continue;
          tl.add(w);
          const arrive = w.end + travel(places, 'campus', HOME);
          const sh = tl.find(shMk, RULES.homeShowerMin, arrive, Math.min(dayEnd, arrive + 30));
          if (sh === null) {
            tl.remove(w.id);
            continue;
          }
          tl.add(shMk(sh, RULES.homeShowerMin));
          workoutPlaced = type;
          workoutLen = len;
          break outer;
        }
      }
    }
    if (!workoutPlaced) {
      workoutUnmet = true;
      notes.push(`No room for the ${type === 'field' ? 'field session' : 'weights session'} today.`);
    } else if (level >= CUT.workout) {
      cuts.push({ level: CUT.workout, text: `Workout shortened to ${fmtDuration(workoutLen)}.` });
    }
  }

  // 6. Meals.
  /** A fixed event that covers most of a meal window (a trip, a dinner event): the meal happens there. */
  const coveringEvent = (from: number, to: number) =>
    placedEvents.find((e) => Math.min(e.end, to) - Math.max(e.start, from) >= (to - from) * 0.75);
  const lunchLocs = [campusDay ? 'campus' : HOME, HOME, workLoc];
  const dinnerLocs = [HOME, 'campus', workLoc];
  const placeMeal = (
    ref: 'lunch' | 'dinner',
    title: string,
    sizes: [number, number][],
    windows: [number, number, Spacing][],
    locs: string[] = lunchLocs,
  ) => {
    const makeAt = (loc: string) => mk('meal', ref, title, loc);
    if (pinnedIds.has(makeAt(HOME)(0, 0).id)) return 'pinned';
    for (const [lo, hi, s] of windows) {
      for (const [minL, maxL] of sizes) {
        const r = bestFlex(makeAt, locs, minL, maxL, Math.max(lo, ws), hi, s);
        if (r) {
          tl.add(makeAt(r.loc)(r.start, r.len), s);
          return r.len;
        }
      }
    }
    return null;
  };
  if (mode !== 'lostDay') {
    if (ws < RULES.lunch.to) {
      const r = placeMeal('lunch', 'Lunch', [[RULES.lunch.len, RULES.lunch.len]], [[RULES.lunch.from, RULES.lunch.to, {}]]);
      if (r === null) {
        const fallback = placeMeal(
          'lunch',
          'Lunch',
          [[RULES.lunch.fallbackLen, RULES.lunch.fallbackLen]],
          [
            [RULES.lunch.from, RULES.lunch.to, { tight: true }],
            [RULES.lunch.to, RULES.lunch.lastResortTo, { tight: true }],
          ],
        );
        const during = coveringEvent(RULES.lunch.from, RULES.lunch.to);
        if (fallback === null && during) notes.push(`Lunch happens during ${during.title}.`);
        else if (fallback === null) warnings.push('No time for lunch today.');
        else notes.push('Lunch is 15 minutes today, between commitments.');
      }
    }
    if (ws < RULES.dinner.lastResortTo) {
      const sizes: [number, number][] = [[RULES.dinner.min, RULES.dinner.max]];
      const r = placeMeal('dinner', 'Dinner', sizes, [[RULES.dinner.from, RULES.dinner.to, {}]], dinnerLocs);
      if (r === null) {
        const late = placeMeal('dinner', 'Dinner', sizes, [[RULES.dinner.lastResortFrom, RULES.dinner.lastResortTo, {}]], dinnerLocs);
        const during = coveringEvent(RULES.dinner.from, RULES.dinner.to);
        if (late === null && during) notes.push(`Dinner happens during ${during.title}.`);
        else if (late === null) warnings.push('No time for dinner today.');
        else notes.push('Dinner falls outside 5:30 to 8:00 PM today because of evening commitments.');
      }
    }
  }

  // Social events (lowest rank), moved, never deleted.
  for (const e of flexible.filter((x) => x.rankKey === 'social')) {
    if (level >= CUT.social && !pinnedIds.has(eventId(date, e))) {
      carryEvents.push(e);
      cuts.push({ level: CUT.social, text: `${e.title} moved to another day.` });
      continue;
    }
    placeFlexible(e);
  }

  // 9. Tasks. The library window takes the queue first, then the Big 3 get the earliest focus slots.
  const workMk = (kind: BlockKind, t: Task, n: number, loc: string) =>
    mk(kind, n === 1 ? t.id : `${t.id}#${n}`, kind === 'library_work' ? `Library: ${t.title}` : t.title, loc, {
      taskId: t.id,
      howto: t.steps?.map((s) => s.text) ?? null,
    });
  const chunkCount: Record<string, number> = {};
  const nextChunk = (t: Task) => (chunkCount[t.id] = (chunkCount[t.id] ?? 0) + 1);
  const record = (t: Task, len: number) => {
    remaining[t.id] = remaining[t.id]! - len;
    placedToday[t.id] = (placedToday[t.id] ?? 0) + len;
  };

  if (libraryWindow) {
    tl.remove(libWin(0, 0).id);
    let at = libraryWindow.start;
    for (const t of queue) {
      while ((remaining[t.id] ?? 0) > 0) {
        const rem = remaining[t.id]!;
        if (placedToday[t.id] && rem < RULES.absorbUnder) {
          remaining[t.id] = 0;
          break;
        }
        const len = Math.min(rem, RULES.chunkMax, libraryWindow.end - at);
        if (len < Math.min(RULES.chunkMin, rem)) break;
        const b = workMk('library_work', t, nextChunk(t), 'library')(at, len);
        tl.add(b);
        record(t, len);
        at = b.end + RULES.bufferMin;
      }
      if (libraryWindow.end - at < RULES.chunkMin) break;
    }
    if (libraryWindow.end - at >= 15) tl.add(mk('library_work', '1', 'Library work', 'library')(at, libraryWindow.end - at));
  }

  const placeTask = (t: Task) => {
    while ((remaining[t.id] ?? 0) > 0) {
      const rem = remaining[t.id]!;
      if (placedToday[t.id] && rem < RULES.absorbUnder) {
        remaining[t.id] = 0;
        return;
      }
      const n = (chunkCount[t.id] ?? 0) + 1;
      const r = tl.findFlex(workMk('work', t, n, workLoc), Math.min(RULES.chunkMin, rem), Math.min(RULES.chunkMax, rem), ws, dayEnd);
      if (!r) return;
      nextChunk(t);
      tl.add(workMk('work', t, n, workLoc)(r.start, r.len));
      record(t, r.len);
    }
  };

  let floorUnmet = false;
  if (working) {
    for (const t of big3) placeTask(t);
    for (const t of schoolUrgent) placeTask(t);

    // Side Hustle Summit floor (D4).
    const floorMk = (len: number) => (loc: string) =>
      mk(
        'shs_floor',
        '1',
        len === RULES.shsFloorMin
          ? `Side Hustle Summit: 30 minutes or ${settings.outreachCount} outreach DMs`
          : 'Side Hustle Summit: 10 minutes of outreach',
        loc,
      );
    const findFloor = (len: number) =>
      bestFlex(floorMk(len), [HOME, workLoc], len, len, 720, dayEnd) ?? bestFlex(floorMk(len), [HOME, workLoc], len, len, ws, dayEnd);
    if (!pinnedIds.has(floorMk(RULES.shsFloorMin)(HOME)(0, 0).id)) {
      const minimal = minimalFloor(mode, input.examWithin7, level);
      let len: number = minimal ? RULES.shsFloorMinimal : RULES.shsFloorMin;
      let r = findFloor(len);
      if (!r && !minimal) {
        floorUnmet = true;
        len = RULES.shsFloorMinimal;
        r = findFloor(len);
        if (r) notes.push('Side Hustle Summit floor is 10 minutes of outreach today: the day is full.');
      }
      if (r) {
        tl.add(floorMk(len)(r.loc)(r.start, r.len));
        if (level >= CUT.floor && mode === 'normal' && !input.examWithin7) {
          cuts.push({ level: CUT.floor, text: 'Side Hustle Summit floor cut to 10 minutes.' });
        } else if (minimal && input.examWithin7 && mode === 'normal') {
          notes.push('Side Hustle Summit floor is 10 minutes of outreach: an exam is within 7 days.');
        }
      } else {
        notes.push('No room for the Side Hustle Summit floor today.');
      }
    }

    // Misc block.
    const miscMk = (loc: string) => mk('misc', '1', 'Misc', loc);
    if (mode === 'normal' && !pinnedIds.has(miscMk(HOME)(0, 0).id)) {
      if (level >= CUT.miscAndGeneral) cuts.push({ level: CUT.miscAndGeneral, text: 'Misc block cut.' });
      else {
        const r =
          bestFlex(miscMk, [HOME, workLoc], RULES.misc.min, RULES.misc.max, RULES.misc.preferFrom, dayEnd) ??
          bestFlex(miscMk, [HOME, workLoc], RULES.misc.min, RULES.misc.max, ws, dayEnd);
        if (r) tl.add(miscMk(r.loc)(r.start, r.len));
        else notes.push('No room for a misc block today.');
      }
    }

    if (level >= CUT.miscAndGeneral) {
      const cut = rest.filter((t) => (remaining[t.id] ?? 0) > 0);
      if (cut.length) {
        cuts.push({ level: CUT.miscAndGeneral, text: `General work moved below the line: ${cut.map((t) => t.title).join(', ')}.` });
      }
      for (const t of cut) belowTheLine.push({ taskId: t.id, title: t.title, minutes: remaining[t.id]!, reason: 'Cut to protect the Big 3.' });
    } else {
      for (const t of rest) placeTask(t);
    }
  } else if (noWork) {
    for (const t of pool) belowTheLine.push({ taskId: t.id, title: t.title, minutes: remaining[t.id]!, reason: 'No work planned today.' });
  }

  // 13. Lost Day: easiest salvage wins first.
  if (mode === 'lostDay') {
    const salvage: string[] = [];
    if (!input.anchors.coldShower.done) salvage.push('Cold shower');
    if (!input.anchors.walk.done) salvage.push('Walk with God');
    const mealRef = ws < RULES.lunch.to ? 'lunch' : 'dinner';
    const mealMk = (loc: string) => mk('meal', mealRef, mealRef === 'lunch' ? 'Lunch' : 'Dinner', loc);
    if (!pinnedIds.has(mealMk(HOME)(0, 0).id) && ws < RULES.dinner.to) {
      const r = bestFlex(mealMk, [HOME, workLoc], RULES.lunch.fallbackLen, RULES.lunch.len, ws, dayEnd);
      if (r) {
        tl.add(mealMk(r.loc)(r.start, r.len));
        salvage.push(mealRef === 'lunch' ? 'Lunch' : 'Dinner');
      }
    }
    const easiest = [...big3].sort((a, b) => remaining[a.id]! - remaining[b.id]! || (a.id < b.id ? -1 : 1))[0];
    if (easiest) {
      const rem = remaining[easiest.id]!;
      const r = tl.findFlex(workMk('work', easiest, 1, workLoc), Math.min(RULES.chunkMin, rem), Math.min(RULES.chunkMax, rem), ws, dayEnd);
      if (r) {
        nextChunk(easiest);
        tl.add(workMk('work', easiest, 1, workLoc)(r.start, r.len));
        record(easiest, r.len);
        salvage.push(easiest.title);
      }
    }
    const type = input.workout ?? 'weights';
    const wMk = mk('workout', type, '30 minute workout', 'campus');
    const shMk = mk('shower', '1', 'Shower at home', HOME);
    for (let s = ceil5(ws); s + RULES.workout.min <= dayEnd; s += 5) {
      const w = wMk(s, RULES.workout.min);
      if (!tl.canPlace(w)) continue;
      tl.add(w);
      const arrive = w.end + travel(places, 'campus', HOME);
      const sh = tl.find(shMk, RULES.homeShowerMin, arrive, Math.min(dayEnd, arrive + 30));
      if (sh === null) {
        tl.remove(w.id);
        continue;
      }
      tl.add(shMk(sh, RULES.homeShowerMin));
      salvage.push('30 minute workout');
      workoutPlaced = type;
      break;
    }
    notes.unshift(`Lost Day. Salvage wins, easiest first: ${salvage.join(', ')}.`);
  }

  // 10. Overflow and deadlines.
  for (const t of pool) {
    const rem = remaining[t.id] ?? 0;
    if (rem <= 0) continue;
    if (!placedToday[t.id] && !belowTheLine.some((b) => b.taskId === t.id)) {
      belowTheLine.push({ taskId: t.id, title: t.title, minutes: rem, reason: working ? 'No free time left today.' : 'Not planned today.' });
    }
    if (t.deadline !== null && t.deadline <= date) {
      warnings.push(`${t.title} does not fit before its deadline. ${fmtDuration(rem)} still unplanned.`);
    }
  }

  const unplacedBig3 = working ? big3.filter((t) => !placedToday[t.id] && (remaining[t.id] ?? 0) > 0) : [];
  for (const t of unplacedBig3) warnings.push(`${t.title} is in the Big 3 but has no free time today.`);
  // Each Big 3 item should get a real session today: its full time, or at least RULES.big3Session minutes.
  const big3Unmet =
    working &&
    big3.some((t) => (remaining[t.id] ?? 0) > 0 && (placedToday[t.id] ?? 0) < Math.min(startRemaining[t.id] ?? 0, RULES.big3Session));
  // Cut warnings in the order of Part 5 step 12 (stable sort keeps the order within a level).
  for (const c of [...cuts].sort((a, b) => a.level - b.level)) warnings.push(cutPrefix + c.text);

  const blocks = withTravel(date, [...tl.blocks].filter((b) => b.id !== libWin(0, 0).id), places);
  return {
    plan: {
      date,
      wakeMin: W,
      blocks,
      belowTheLine,
      warnings,
      notes,
      bedtime,
      remaining,
      carryEvents,
      workoutPlaced,
    },
    unmet: big3Unmet || floorUnmet || workoutUnmet,
  };
}

function minimalFloor(mode: DayInput['mode'], examWithin7: boolean, level: number): boolean {
  return mode === 'codeRed' || examWithin7 || level >= CUT.floor;
}

function lengthsDown(from: number, to: number): number[] {
  const out: number[] = [];
  for (let l = from; l >= to; l -= 5) out.push(l);
  return out;
}

export function eventId(date: string, e: EventInstance): string {
  return `${date}:${eventBlockKind(e)}:${e.id}`;
}

function eventBlock(date: string, e: EventInstance): Block {
  return {
    id: eventId(date, e),
    date,
    start: e.start,
    end: e.end,
    kind: eventBlockKind(e),
    title: e.title,
    placeId: e.location,
    taskId: null,
    eventId: e.id,
    status: 'planned',
    pinned: false,
    source: 'planner',
    howto: null,
  };
}

/** Insert a drive block before every block that is at a different place than the one before it. */
export function withTravel(date: string, blocks: Block[], places: DayInput['places']): Block[] {
  const sorted = [...blocks].filter((b) => b.kind !== 'travel').sort((x, y) => x.start - y.start || x.end - y.end || (x.id < y.id ? -1 : 1));
  const out: Block[] = [];
  let prevLoc = HOME;
  let prevEnd = -Infinity;
  let n = 0;
  for (const b of sorted) {
    const loc = b.placeId ?? HOME;
    const t = travel(places, prevLoc, loc);
    // When two fixed events are too close, the drive starts when the first one ends (a warning says so).
    const start = Math.max(prevEnd, b.start - t);
    if (t > 0 && start < b.start) {
      n += 1;
      out.push({
        id: `${date}:travel:${n}`,
        date,
        start,
        end: b.start,
        kind: 'travel',
        title: `Drive to ${placeName(places, loc)}`,
        placeId: loc,
        taskId: null,
        eventId: null,
        status: 'planned',
        pinned: false,
        source: 'planner',
        howto: null,
      });
    }
    out.push(b);
    prevLoc = loc;
    prevEnd = Math.max(prevEnd, b.end);
  }
  return out.sort((x, y) => x.start - y.start || x.end - y.end || (x.id < y.id ? -1 : 1));
}
