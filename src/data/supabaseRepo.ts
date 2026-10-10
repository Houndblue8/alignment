// Supabase implementation of Repo. Maps camelCase models to snake_case rows. RLS scopes every query to Eli.
import type { Block, EventDef, Place } from '../planner';
import type { Contract, DayRecord, Quote, Settings, TaskRow, Vision } from './model';
import { emptyPlan } from './model';
import type { Repo } from './repo';
import { supabase } from './supabase';

type Row = Record<string, unknown>;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

const settingsTo = (s: Settings): Row => ({
  theme: s.theme,
  outreach_count: s.outreachCount,
  wake_target_min: s.wakeTargetMin,
  sleep_hours: s.sleepHours,
  latest_wake_min: s.latestWakeMin,
  practice_block: s.practiceBlock,
  code_red: s.codeRed,
  code_red_level: s.codeRedLevel,
  graduation_date: s.graduationDate,
  last_open_date: s.lastOpenDate,
  notify_photo: s.notifyPhoto,
  photo_reminder_min: s.photoReminderMin,
  notify_morning: s.notifyMorning,
  notify_evening: s.notifyEvening,
  notify_bedtime: s.notifyBedtime,
  notify_blocks: s.notifyBlocks,
  updated_at: new Date().toISOString(),
});
const settingsFrom = (r: Row): Settings => ({
  theme: r.theme as string,
  outreachCount: r.outreach_count as number,
  wakeTargetMin: r.wake_target_min as number,
  sleepHours: Number(r.sleep_hours),
  latestWakeMin: r.latest_wake_min as number,
  practiceBlock: r.practice_block as 'A' | 'B',
  codeRed: r.code_red as boolean,
  codeRedLevel: r.code_red_level as Settings['codeRedLevel'],
  graduationDate: (r.graduation_date as string) ?? null,
  lastOpenDate: (r.last_open_date as string) ?? null,
  notifyMorning: r.notify_morning !== false,
  notifyEvening: r.notify_evening !== false,
  notifyBedtime: r.notify_bedtime !== false,
  notifyBlocks: r.notify_blocks === true,
  notifyPhoto: r.notify_photo !== false,
  photoReminderMin: (r.photo_reminder_min as number) ?? 720,
});

const visionTo = (v: Vision): Row => ({
  identity: v.identity,
  why: v.why,
  why_short: v.whyShort,
  end_result: v.endResult,
  perfect_day: v.perfectDay,
  best_version: v.bestVersion,
  updated_at: new Date().toISOString(),
});
const visionFrom = (r: Row): Vision => ({
  identity: r.identity as string,
  why: r.why as string,
  whyShort: r.why_short as string,
  endResult: r.end_result as string,
  perfectDay: r.perfect_day as string,
  bestVersion: r.best_version as Vision['bestVersion'],
});

const contractTo = (c: Contract): Row => ({
  terms: c.terms,
  locked: c.locked,
  signed_name: c.signedName,
  signed_at: c.signedAt,
  graduation_date: c.graduationDate,
  profit_target: c.profitTarget,
  first_milestone: c.firstMilestone,
  profit_earned: c.profitEarned,
  updated_at: new Date().toISOString(),
});
const contractFrom = (r: Row): Contract => ({
  terms: r.terms as string[],
  locked: !!r.locked,
  signedName: (r.signed_name as string) ?? null,
  signedAt: (r.signed_at as string) ?? null,
  graduationDate: (r.graduation_date as string) ?? null,
  profitTarget: Number(r.profit_target),
  firstMilestone: Number(r.first_milestone),
  profitEarned: Number(r.profit_earned),
});

const placeTo = (p: Place): Row => ({
  id: p.id,
  name: p.name,
  notes: p.notes ?? '',
  minutes_from_home: p.minutesFromHome,
  minutes_from_campus: p.minutesFromCampus,
  good_for: p.goodFor,
});
const placeFrom = (r: Row): Place => ({
  id: r.id as string,
  name: r.name as string,
  notes: r.notes as string,
  minutesFromHome: r.minutes_from_home as number,
  minutesFromCampus: r.minutes_from_campus as number,
  goodFor: r.good_for as Place['goodFor'],
});

const eventTo = (e: EventDef): Row => ({
  id: e.id,
  title: e.title,
  kind: e.kind,
  weekday: e.weekday ?? null,
  date: e.date ?? null,
  end_date: e.endDate ?? null,
  start_min: e.start,
  end_min: e.end,
  location: e.location,
  rank_key: e.rankKey,
  immovable: e.immovable,
  overridable_by_code_red: e.overridableByCodeRed,
  recurring_weekly: e.recurringWeekly,
  active_from: e.activeFrom ?? null,
  active_to: e.activeTo ?? null,
  skip_dates: e.skipDates ?? [],
  practice_block: e.practiceBlock ?? null,
  all_day: !!e.allDay,
  no_work: !!e.noWork,
  away: !!e.away,
  tentative: !!e.tentative,
});
const eventFrom = (r: Row): EventDef => {
  const e: EventDef = {
    id: r.id as string,
    title: r.title as string,
    kind: r.kind as EventDef['kind'],
    start: r.start_min as number,
    end: r.end_min as number,
    location: r.location as string,
    rankKey: r.rank_key as EventDef['rankKey'],
    immovable: r.immovable as boolean,
    overridableByCodeRed: r.overridable_by_code_red as boolean,
    recurringWeekly: r.recurring_weekly as boolean,
  };
  if (r.weekday !== null) e.weekday = r.weekday as number;
  if (r.date) e.date = r.date as string;
  if (r.end_date) e.endDate = r.end_date as string;
  if (r.active_from) e.activeFrom = r.active_from as string;
  if (r.active_to) e.activeTo = r.active_to as string;
  if ((r.skip_dates as string[]).length) e.skipDates = r.skip_dates as string[];
  if (r.practice_block) e.practiceBlock = r.practice_block as 'A' | 'B';
  if (r.all_day) e.allDay = true;
  if (r.no_work) e.noWork = true;
  if (r.away) e.away = true;
  if (r.tentative) e.tentative = true;
  return e;
};

const taskTo = (t: TaskRow): Row => ({
  id: t.id,
  title: t.title,
  journey: t.journey,
  importance: t.importance,
  deadline: t.deadline,
  estimated_minutes: t.estimatedMinutes,
  steps: t.steps ?? [],
  deferral_count: t.deferralCount,
  status: t.status,
  work_type: t.workType,
  notes: t.notes,
  created_at: t.createdAt,
  completed_at: t.completedAt,
});
const taskFrom = (r: Row): TaskRow => ({
  id: r.id as string,
  title: r.title as string,
  journey: r.journey as TaskRow['journey'],
  importance: r.importance as number,
  deadline: (r.deadline as string) ?? null,
  estimatedMinutes: r.estimated_minutes as number,
  steps: r.steps as TaskRow['steps'],
  deferralCount: r.deferral_count as number,
  status: r.status as TaskRow['status'],
  workType: r.work_type as TaskRow['workType'],
  notes: r.notes as string,
  createdAt: r.created_at as string,
  completedAt: (r.completed_at as string) ?? null,
});

const dayTo = (d: DayRecord): Row => ({
  date: d.date,
  wake_min: d.wakeMin,
  checkin_done: d.checkinDone,
  cold_shower: d.coldShower,
  walk: d.walk,
  big3: d.big3,
  result: d.result,
  lost_day: d.lostDay,
  lost_day_reason: d.lostDayReason,
  code_red: d.codeRed,
  notes: d.notes,
  plan: d.plan,
  isaac_answer: d.isaacAnswer,
  updated_at: new Date().toISOString(),
});
const dayFrom = (r: Row): DayRecord => ({
  date: r.date as string,
  wakeMin: (r.wake_min as number) ?? null,
  checkinDone: r.checkin_done as boolean,
  coldShower: r.cold_shower as DayRecord['coldShower'],
  walk: r.walk as DayRecord['walk'],
  big3: r.big3 as DayRecord['big3'],
  result: (r.result as DayRecord['result']) ?? null,
  lostDay: r.lost_day as boolean,
  lostDayReason: (r.lost_day_reason as string) ?? null,
  codeRed: r.code_red as boolean,
  notes: r.notes as string,
  plan: { ...emptyPlan(), ...(r.plan as object) },
  isaacAnswer: (r.isaac_answer as DayRecord['isaacAnswer']) ?? null,
});

const blockTo = (b: Block): Row => ({
  id: b.id,
  date: b.date,
  start_min: b.start,
  end_min: b.end,
  kind: b.kind,
  title: b.title,
  place_id: b.placeId,
  task_id: b.taskId,
  event_id: b.eventId,
  status: b.status,
  pinned: b.pinned,
  source: b.source,
  howto: b.howto,
});
const blockFrom = (r: Row): Block => ({
  id: r.id as string,
  date: r.date as string,
  start: r.start_min as number,
  end: r.end_min as number,
  kind: r.kind as Block['kind'],
  title: r.title as string,
  placeId: (r.place_id as string) ?? null,
  taskId: (r.task_id as string) ?? null,
  eventId: (r.event_id as string) ?? null,
  status: r.status as Block['status'],
  pinned: r.pinned as boolean,
  source: r.source as Block['source'],
  howto: (r.howto as string[]) ?? null,
});

const quoteFrom = (r: Row): Quote => ({ id: r.id as string, text: r.text as string, tags: r.tags as Quote['tags'] });

export const supabaseRepo: Repo = {
  async load(blocksSince) {
    const settings = await must(supabase.from('settings').select('*').maybeSingle());
    if (!settings) return null;
    const [vision, contract, places, events, tasks, days, blocks, quotes, photos] = await Promise.all([
      must(supabase.from('vision').select('*').single()),
      must(supabase.from('contract').select('*').single()),
      must(supabase.from('places').select('*').order('id')),
      must(supabase.from('events').select('*').order('id')),
      must(supabase.from('tasks').select('*').order('created_at')),
      must(supabase.from('day_records').select('*').order('date')),
      must(supabase.from('blocks').select('*').gte('date', blocksSince).order('date').order('start_min').limit(5000)),
      must(supabase.from('quotes').select('*').order('created_at')),
      must(supabase.from('photos').select('*').order('date')),
    ]);
    return {
      settings: settingsFrom(settings),
      vision: visionFrom(vision),
      contract: contractFrom(contract),
      places: (places ?? []).map(placeFrom),
      events: (events ?? []).map(eventFrom),
      tasks: (tasks ?? []).map(taskFrom),
      days: Object.fromEntries((days ?? []).map((r) => [r.date as string, dayFrom(r)])),
      blocks: (blocks ?? []).map(blockFrom),
      quotes: (quotes ?? []).map(quoteFrom),
      photos: (photos ?? []).map((r) => ({ date: r.date as string, storagePath: r.storage_path as string, caption: r.caption as string, milestone: r.milestone as boolean })),
    };
  },

  async seed(s) {
    const opts = { ignoreDuplicates: true };
    await must(supabase.from('vision').upsert(visionTo(s.vision), opts));
    await must(supabase.from('contract').upsert(contractTo(s.contract), opts));
    await must(supabase.from('places').upsert(s.places.map(placeTo), opts));
    await must(supabase.from('events').upsert(s.events.map(eventTo), opts));
    await must(supabase.from('quotes').upsert(s.quotes.map((q) => ({ id: q.id, text: q.text, tags: q.tags })), opts));
    // Settings last: its presence marks the account as seeded.
    await must(supabase.from('settings').upsert({ ...settingsTo(s.settings), seeded_at: new Date().toISOString() }, opts));
  },

  saveSettings: async (s) => void (await must(supabase.from('settings').upsert(settingsTo(s)))),
  saveVision: async (v) => void (await must(supabase.from('vision').upsert(visionTo(v)))),
  saveContract: async (c) => void (await must(supabase.from('contract').upsert(contractTo(c)))),
  upsertPlaces: async (p) => void (await must(supabase.from('places').upsert(p.map(placeTo)))),
  upsertEvents: async (e) => void (await must(supabase.from('events').upsert(e.map(eventTo)))),
  deleteEvent: async (id) => void (await must(supabase.from('events').delete().eq('id', id))),
  upsertTasks: async (t) => void (await must(supabase.from('tasks').upsert(t.map(taskTo)))),
  deleteTask: async (id) => void (await must(supabase.from('tasks').delete().eq('id', id))),
  upsertDays: async (d) => void (await must(supabase.from('day_records').upsert(d.map(dayTo)))),
  async replaceBlocks(dates, blocks) {
    if (dates.length) await must(supabase.from('blocks').delete().in('date', dates));
    if (blocks.length) await must(supabase.from('blocks').upsert(blocks.map(blockTo)));
  },
  upsertQuote: async (q) => void (await must(supabase.from('quotes').upsert({ id: q.id, text: q.text, tags: q.tags }))),
  deleteQuote: async (id) => void (await must(supabase.from('quotes').delete().eq('id', id))),
  async addOpsLog(entry) {
    const row = await must(
      supabase
        .from('ops_log')
        .insert({ input_text: entry.inputText, ops: entry.ops, unhandled: entry.unhandled, snapshot_before: entry.snapshotBefore })
        .select('id')
        .single(),
    );
    return (row as { id: string }).id;
  },
  markUndone: async (id) => void (await must(supabase.from('ops_log').update({ undone: true }).eq('id', id))),
  async getCoach(date, kind) {
    const row = await must(supabase.from('coach_cache').select('text').eq('date', date).eq('kind', kind).maybeSingle());
    return (row as { text: string } | null)?.text ?? null;
  },
  saveCoach: async (date, kind, text) => void (await must(supabase.from('coach_cache').upsert({ date, kind, text }))),
  async getReport(type, periodStart) {
    const row = await must(supabase.from('reports').select('body').eq('type', type).eq('period_start', periodStart).maybeSingle());
    return (row as { body: unknown } | null)?.body ?? null;
  },
  saveReport: async (type, periodStart, body) =>
    void (await must(supabase.from('reports').upsert({ type, period_start: periodStart, body, created_at: new Date().toISOString() }))),
  async uploadPhoto(date, file) {
    const { data: who } = await supabase.auth.getUser();
    if (!who.user) throw new Error('Sign in first.');
    const path = `${who.user.id}/${date}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    return path;
  },
  savePhoto: async (p) =>
    void (await must(supabase.from('photos').upsert({ date: p.date, storage_path: p.storagePath, caption: p.caption, milestone: p.milestone }))),
  async deletePhoto(p) {
    await supabase.storage.from('photos').remove([p.storagePath]);
    await must(supabase.from('photos').delete().eq('date', p.date));
  },
  async photoUrls(paths) {
    if (!paths.length) return {};
    const { data, error } = await supabase.storage.from('photos').createSignedUrls(paths, 3600);
    if (error) throw new Error(error.message);
    return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
  },
};
