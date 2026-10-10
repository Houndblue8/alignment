import { create } from 'zustand';
import { localRepo } from '../data/localRepo';
import type { Big3Item, Contract, DayRecord, PhotoRow, Quote, QuoteTag, Settings, Snapshot, TaskRow, Vision } from '../data/model';
import { DATA_MODE, type Repo } from '../data/repo';
import { seedSnapshot } from '../data/seedData';
import { supabaseRepo } from '../data/supabaseRepo';
import { nowLocal, type Now } from '../lib/clock';
import { shrinkPhoto } from '../lib/image';
import { addDays, confirmTentative, diffBlocks, diffDays, fmtDate, fmtTime, sameThing, weekday, weekStart, type Block, type EventDef, type Journey, type Place } from '../planner';
import { ai } from '../ops/ai';
import { anchorLines, applyOps, reshapedLine, restoreSnapshot, undoSnapshot, type UndoSnapshot } from '../ops/apply';
import type { RecentMessage } from '../ops/context';
import { runDump } from '../ops/pipeline';
import { applyTheme } from '../theme/theme';
import { cleanReport, draftReport, factsForCoach, weekClosed, weekFacts, type StoredReport } from './report';
import { saveableTemple, type SavedTemple } from './temple';
import { buildWeek, dayOf, fillBig3, finalizePast, resultFor, suggestAgain as suggestAgainPure } from './planning';

const repo: Repo = DATA_MODE === 'local' ? localRepo : supabaseRepo;

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface AppState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  s: Snapshot | null;
  now: Now;
  toast: Toast | null;
  busy: boolean;

  init(): Promise<void>;
  tick(): void;
  showToast(text: string, kind?: Toast['kind']): void;

  signContract(name: string): Promise<void>;
  checkIn(input: { wakeMin: number; coldShowerDone: boolean; walkDone: boolean; big3?: Big3Item[] }): Promise<void>;
  editWake(wakeMin: number): Promise<void>;
  setAnchor(kind: 'coldShower' | 'walk', done: boolean): Promise<void>;
  setBlockStatus(id: string, status: Block['status']): Promise<void>;
  /** Close out a past day late: the anchor counts for that day and the day is scored again. */
  setPastAnchor(date: string, kind: 'coldShower' | 'walk', done: boolean): Promise<void>;
  /** Log a small step toward a pillar today. */
  logStep(pillar: Journey, text: string): Promise<void>;
  removeStep(index: number): Promise<void>;
  /** Tonight's one thing to do 1% better tomorrow. */
  setKaizen(text: string): Promise<void>;
  /** The night tap: a pillar Eli showed up for today that the app could not see. */
  toggleShowedUp(pillar: Journey): Promise<void>;
  /** The night check: Mind, Heart, Spirit (1 to 5) and an optional line. */
  setInner(inner: NonNullable<DayRecord['inner']>): Promise<void>;
  /**
   * Plans changed: this block is not happening. An event is skipped for that day only, anything else is taken
   * off, and the rest of the day is rebuilt from now so the freed time gets used. Returns what moved in.
   */
  cancelBlock(id: string): Promise<void>;
  /**
   * Close out a past day's Big 3 item. It counts for that day only, so a daily habit ("Lift") is not checked
   * off for today. Finishing a one-time task for good is a separate tap (setTaskDone with the date).
   */
  setPastBig3(date: string, taskId: string, done: boolean): Promise<void>;
  togglePin(id: string): Promise<void>;
  replan(): Promise<void>;

  setBig3(items: Big3Item[]): Promise<void>;
  acceptSuggestion(taskId: string): Promise<void>;
  suggestAgain(): Promise<void>;
  createTask(t: Pick<TaskRow, 'title' | 'journey' | 'importance' | 'estimatedMinutes' | 'deadline' | 'workType'>): Promise<string>;
  /** date: the day it was done (a past day when closing out yesterday). Defaults to today. */
  setTaskDone(id: string, done: boolean, date?: string): Promise<void>;

  startLostDay(reason: string): Promise<void>;
  endLostDay(): Promise<void>;
  setCodeRed(on: boolean, level?: Settings['codeRedLevel']): Promise<void>;
  answerIsaac(yes: boolean, startMin?: number): Promise<void>;

  saveSettings(patch: Partial<Settings>): Promise<void>;
  saveEvent(e: EventDef): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  savePlace(p: Place): Promise<void>;
  saveVision(v: Vision): Promise<void>;
  saveContract(patch: Partial<Contract>): Promise<void>;
  addQuote(text: string, tags: QuoteTag[]): Promise<void>;
  deleteQuote(id: string): Promise<void>;

  /** Days since the app was last opened before today (0 when opened yesterday or today). */
  awayDays: number;
  coachLine: string | null;
  loadCoachLine(): Promise<void>;
  /** The decision after 3 deferrals (Appendix B 7). */
  decideTask(id: string, choice: 'today' | 'schedule' | 'delegate' | 'drop', date?: string): Promise<{ draft: string | null } | void>;

  /** Daily photo (Appendix E 1): taken any time of day, one per day. */
  addPhoto(file: File, caption: string): Promise<void>;
  updatePhoto(date: string, patch: Partial<Pick<PhotoRow, 'caption' | 'milestone'>>): Promise<void>;
  removePhoto(date: string): Promise<void>;
  photoUrls(paths: string[]): Promise<Record<string, string>>;
  captionQuestion(): Promise<string | null>;
  /** The scouting report for a closed week: saved one, or written now (rewrite = write it again). */
  scoutingReport(weekStart: string, rewrite?: boolean): Promise<StoredReport | null>;
  /** Finished temples, oldest first (saved as numbers when each week closes). */
  temples(): Promise<SavedTemple[]>;

  /** The talk box result card. */
  lastDump: DumpCard | null;
  dump(text: string): Promise<{ ok: boolean; message?: string }>;
  undoDump(): Promise<void>;
  dismissDump(): void;
}

export interface DumpCard {
  logId: string;
  text: string;
  done: string[];
  cantDo: { text: string; reason: string }[];
  question: string | null;
  /** How the rest of today moved after the change ("Day reshaped: ..."). */
  reshaped: string | null;
  undone: boolean;
  before: UndoSnapshot;
  /** Manual blocks this dump added beyond the planned week (removed on Undo). */
  farBlockIds: string[];
}

let toastId = 0;
/** Signed photo links last an hour; cache them for the session. */
const photoUrlCache = new Map<string, string>();

/** Plain-language error text for the screen. */
function message(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/fetch|network/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
  return `Something went wrong: ${m}`;
}

const RECENT_KEY = 'alignment.recentDumps';

/** Today's talk box messages (this device), for follow-ups like "that got cancelled". */
function recentToday(date: string): RecentMessage[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? 'null') as { date: string; items: RecentMessage[] } | null;
    return saved?.date === date ? saved.items : [];
  } catch {
    return [];
  }
}

function rememberDump(date: string, m: RecentMessage): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify({ date, items: [...recentToday(date), m].slice(-5) }));
  } catch {
    // Follow-ups still work, just without the earlier message.
  }
}

function forgetDump(said: string): void {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? 'null') as { date: string; items: RecentMessage[] } | null;
    if (saved) localStorage.setItem(RECENT_KEY, JSON.stringify({ ...saved, items: saved.items.filter((i) => i.said !== said) }));
  } catch {
    // Nothing to forget.
  }
}

/** A block that stands for a task without being work time: an event, the workout, a meal, a manual block. */
const isLinkedBlock = (b: Block): boolean => !!b.taskId && b.kind !== 'work' && b.kind !== 'library_work';

/** Done on a given day: a past day's completion is stamped that evening, so it counts for that day. */
function setDone(t: TaskRow, done: boolean, date: string): TaskRow {
  const when = date === nowLocal().date ? new Date().toISOString() : `${date}T20:00:00-07:00`;
  return { ...t, status: done ? 'done' : 'open', completedAt: done ? new Date(when).toISOString() : null };
}

export const useApp = create<AppState>((set, get) => {
  /** Replace a day record in the snapshot. */
  const withDay = (s: Snapshot, d: DayRecord): Snapshot => ({ ...s, days: { ...s.days, [d.date]: d } });

  /** A past day that was closed out late gets its result again (forgot to check things off that night). */
  async function rescore(s: Snapshot, date: string): Promise<Snapshot> {
    const rec = s.days[date];
    if (!rec || date >= nowLocal().date || !rec.result) return s;
    const result = resultFor(s, date);
    if (result === rec.result) return s;
    const day = { ...rec, result };
    await repo.upsertDays([day]);
    return withDay(s, day);
  }

  /**
   * Re-run the planner for today and the next 6 days, save, and return how many of today's blocks changed.
   * fromMin rebuilds from a later time than now ("I'm running 30 minutes behind").
   */
  async function rebuild(s: Snapshot, fromMin: number | null = null): Promise<{ s: Snapshot; changed: number }> {
    const now = nowLocal();
    const before = s.blocks.filter((b) => b.date === now.date);
    const built = buildWeek(s, fromMin === null ? now : { date: now.date, min: Math.max(now.min, fromMin) });
    const blocks = [...s.blocks.filter((b) => !built.dates.includes(b.date)), ...built.blocks];
    const days = { ...s.days };
    for (const d of built.days) days[d.date] = d;
    const next = { ...s, blocks, days };
    set({ s: next, now });
    await repo.replaceBlocks(built.dates, built.blocks);
    await repo.upsertDays(built.days);
    return { s: next, changed: diffBlocks(before, built.blocks.filter((b) => b.date === now.date)).count };
  }

  /** Apply a change, save it, rebuild the plan if asked, and report errors on screen. */
  async function run(fn: (s: Snapshot) => Promise<Snapshot | void>, opts: { replan?: boolean } = {}): Promise<void> {
    const s = get().s;
    if (!s) return;
    set({ busy: true });
    try {
      const next = (await fn(s)) ?? get().s!;
      set({ s: next });
      if (opts.replan) await rebuild(next);
    } catch (e) {
      get().showToast(message(e), 'error');
    } finally {
      set({ busy: false });
    }
  }

  const today = () => nowLocal().date;

  return {
    status: 'loading',
    error: null,
    s: null,
    now: nowLocal(),
    toast: null,
    busy: false,

    async init() {
      set({ status: 'loading', error: null });
      try {
        const now = nowLocal();
        let s = await repo.load(addDays(now.date, -42));
        if (!s) {
          await repo.seed(seedSnapshot());
          s = await repo.load(addDays(now.date, -42));
          if (!s) throw new Error('Seeding did not save.');
        }
        applyTheme(s.settings.theme);
        // Close past days (scores and deferrals) on the first open of a new day.
        const fin = finalizePast(s, now.date);
        if (fin.days.length || fin.taskIds.length) {
          const tasks = s.tasks.map((t) => (fin.taskIds.includes(t.id) ? { ...t, deferralCount: t.deferralCount + 1 } : t));
          for (const d of fin.days) s = withDay(s, d);
          s = { ...s, tasks };
          await repo.upsertDays(fin.days);
          if (fin.taskIds.length) await repo.upsertTasks(tasks.filter((t) => fin.taskIds.includes(t.id)));
        }
        const prevOpen = s.settings.lastOpenDate;
        set({ awayDays: prevOpen && prevOpen < now.date ? diffDays(prevOpen, now.date) - 1 : 0 });
        if (s.settings.lastOpenDate !== now.date) {
          s = { ...s, settings: { ...s.settings, lastOpenDate: now.date } };
          await repo.saveSettings(s.settings);
        }
        set({ s, now, status: 'ready' });
      } catch (e) {
        set({ status: 'error', error: message(e) });
      }
    },

    tick: () => set({ now: nowLocal() }),

    showToast(text, kind = 'info') {
      const id = ++toastId;
      set({ toast: { id, text, kind } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 4000);
    },

    signContract: (name) =>
      run(async (s) => {
        const contract = { ...s.contract, signedName: name.trim(), signedAt: new Date().toISOString() };
        await repo.saveContract(contract);
        return { ...s, contract };
      }),

    checkIn: ({ wakeMin, coldShowerDone, walkDone, big3 }) =>
      run(
        async (s) => {
          const date = today();
          const rec = dayOf(s, date);
          const day: DayRecord = {
            ...rec,
            wakeMin,
            checkinDone: true,
            coldShower: { done: coldShowerDone },
            walk: { done: walkDone },
            // Eli's picks are the Big 3. Picking none leaves it to the automatic suggestions.
            big3: big3 && big3.length ? big3.filter((i) => s.tasks.some((t) => t.id === i.taskId && t.status === 'open')) : fillBig3(s, date, rec.big3),
          };
          await repo.upsertDays([day]);
          return withDay(s, day);
        },
        { replan: true },
      ),

    editWake: (wakeMin) =>
      run(
        async (s) => {
          const day = { ...dayOf(s, today()), wakeMin };
          await repo.upsertDays([day]);
          // Planned anchor blocks move with the new wake time.
          return withDay({ ...s, blocks: s.blocks.filter((b) => !(b.date === day.date && b.kind.startsWith('anchor_') && b.status !== 'done')) }, day);
        },
        { replan: true },
      ),

    setAnchor: (kind, done) =>
      run(async (s) => {
        const rec = dayOf(s, today());
        const blockKind = kind === 'coldShower' ? 'anchor_cold_shower' : 'anchor_walk';
        const block = s.blocks.find((b) => b.date === rec.date && b.kind === blockKind);
        const day = { ...rec, [kind]: { done, startMin: block?.start ?? null } };
        const blocks = s.blocks.map((b) => (b.id === block?.id ? { ...b, status: done ? ('done' as const) : ('planned' as const) } : b));
        await repo.upsertDays([day]);
        await repo.replaceBlocks([rec.date], blocks.filter((b) => b.date === rec.date));
        return withDay({ ...s, blocks }, day);
      }),

    setPastAnchor: (date, kind, done) =>
      run(async (s) => {
        const rec = dayOf(s, date);
        const day = { ...rec, [kind]: { ...rec[kind], done } };
        const blockKind = kind === 'coldShower' ? 'anchor_cold_shower' : 'anchor_walk';
        const blocks = s.blocks.map((b) => (b.date === date && b.kind === blockKind ? { ...b, status: done ? ('done' as const) : ('planned' as const) } : b));
        await repo.upsertDays([day]);
        await repo.replaceBlocks([date], blocks.filter((b) => b.date === date));
        return rescore(withDay({ ...s, blocks }, day), date);
      }),

    logStep: (pillar, text) =>
      run(async (s) => {
        const rec = dayOf(s, today());
        const day = { ...rec, steps: [...(rec.steps ?? []), { pillar, text: text.trim() }] };
        await repo.upsertDays([day]);
        return withDay(s, day);
      }),

    removeStep: (index) =>
      run(async (s) => {
        const rec = dayOf(s, today());
        const day = { ...rec, steps: (rec.steps ?? []).filter((_, i) => i !== index) };
        await repo.upsertDays([day]);
        return withDay(s, day);
      }),

    toggleShowedUp: (pillar) =>
      run(async (s) => {
        const rec = dayOf(s, today());
        const cur = rec.showedUp ?? [];
        const day = { ...rec, showedUp: cur.includes(pillar) ? cur.filter((p) => p !== pillar) : [...cur, pillar] };
        await repo.upsertDays([day]);
        return withDay(s, day);
      }),

    setInner: (inner) =>
      run(async (s) => {
        const day = { ...dayOf(s, today()), inner: { ...inner, note: inner.note?.trim() || undefined } };
        await repo.upsertDays([day]);
        return withDay(s, day);
      }),

    setKaizen: (text) =>
      run(async (s) => {
        const day = { ...dayOf(s, today()), kaizen: text.trim() || null };
        await repo.upsertDays([day]);
        return withDay(s, day);
      }),

    async cancelBlock(id) {
      const s = get().s;
      const b = s?.blocks.find((x) => x.id === id);
      if (!s || !b) return;
      set({ busy: true });
      try {
        let next: Snapshot = s;
        const ev = b.eventId ? s.events.find((e) => e.id === b.eventId) : undefined;
        if (ev) {
          const row = ev.recurringWeekly ? { ...ev, skipDates: [...(ev.skipDates ?? []), b.date] } : null;
          if (row) await repo.upsertEvents([row]);
          else await repo.deleteEvent(ev.id);
          next = { ...next, events: row ? next.events.map((e) => (e.id === ev.id ? row : e)) : next.events.filter((e) => e.id !== ev.id) };
        }
        const rec = dayOf(next, b.date);
        const day = { ...rec, plan: { ...rec.plan, suppressed: [...(rec.plan.suppressed ?? []), b.id] } };
        await repo.upsertDays([day]);
        next = withDay({ ...next, blocks: next.blocks.filter((x) => x.id !== b.id) }, day);
        const before = next.blocks.filter((x) => x.date === b.date);
        const { s: rebuilt } = await rebuild(next);
        const moved = rebuilt.blocks
          .filter((x) => x.date === b.date && x.start < b.end && x.end > b.start && x.kind !== 'travel')
          .filter((x) => !before.some((y) => y.id === x.id && y.start === x.start))
          .sort((x, y) => x.start - y.start)
          .slice(0, 3)
          .map((x) => `${x.title} at ${fmtTime(x.start)}`);
        get().showToast(`${b.title} cancelled.${moved.length ? ` Now in that time: ${moved.join(', ')}.` : ' That time is open.'}`);
      } catch (e) {
        get().showToast(`Could not cancel. ${message(e)}`, 'error');
      } finally {
        set({ busy: false });
      }
    },

    setPastBig3: (date, taskId, done) =>
      run(async (s) => {
        const rec = dayOf(s, date);
        const day = { ...rec, big3: rec.big3.map((i) => (i.taskId === taskId ? { ...i, done } : i)) };
        await repo.upsertDays([day]);
        return rescore(withDay(s, day), date);
      }),

    setBlockStatus: (id, status) =>
      run(async (s) => {
        const blocks = s.blocks.map((b) => (b.id === id ? { ...b, status } : b));
        const block = s.blocks.find((b) => b.id === id);
        const date = block?.date;
        if (date) await repo.replaceBlocks([date], blocks.filter((b) => b.date === date));
        // A block that is a task (the workout for "Lift", dinner for "Intentional dinner") checks the task off too.
        const linked = block && isLinkedBlock(block) ? s.tasks.find((t) => t.id === block.taskId) : undefined;
        if (linked && (status === 'done') !== (linked.status === 'done')) {
          const row = setDone(linked, status === 'done', date!);
          await repo.upsertTasks([row]);
          return rescore({ ...s, blocks, tasks: s.tasks.map((t) => (t.id === row.id ? row : t)) }, date!);
        }
        return { ...s, blocks };
      }),

    togglePin: (id) =>
      run(async (s) => {
        const blocks = s.blocks.map((b) => (b.id === id ? { ...b, pinned: !b.pinned } : b));
        const date = s.blocks.find((b) => b.id === id)?.date;
        if (date) await repo.replaceBlocks([date], blocks.filter((b) => b.date === date));
        return { ...s, blocks };
      }),

    async replan() {
      const s = get().s;
      if (!s) return;
      set({ busy: true });
      try {
        const { changed } = await rebuild(s);
        const from = fmtTime(Math.ceil(nowLocal().min / 5) * 5);
        get().showToast(changed === 0 ? 'Nothing needed to change.' : `Replanned from ${from}. ${changed} ${changed === 1 ? 'block' : 'blocks'} changed.`);
      } catch (e) {
        get().showToast(`Replan failed. ${message(e)}`, 'error');
      } finally {
        set({ busy: false });
      }
    },

    setBig3: (items) =>
      run(
        async (s) => {
          const day = { ...dayOf(s, today()), big3: items.slice(0, 3) };
          await repo.upsertDays([day]);
          return withDay(s, day);
        },
        { replan: true },
      ),

    acceptSuggestion: (taskId) =>
      run(async (s) => {
        const rec = dayOf(s, today());
        const day = { ...rec, big3: rec.big3.map((i) => (i.taskId === taskId ? { ...i, accepted: true } : i)) };
        await repo.upsertDays([day]);
        return withDay(s, day);
      }),

    suggestAgain: () =>
      run(
        async (s) => {
          const rec = dayOf(s, today());
          const day = { ...rec, big3: suggestAgainPure(s, rec.date, rec.big3) };
          await repo.upsertDays([day]);
          return withDay(s, day);
        },
        { replan: true },
      ),

    async createTask(t) {
      // The same task in other words is reused, not created twice.
      const twin = get().s?.tasks.find((x) => x.status === 'open' && sameThing(x.title, t.title));
      if (twin) {
        get().showToast(`Using your existing task: ${twin.title}.`);
        return twin.id;
      }
      const id = crypto.randomUUID();
      await run(async (s) => {
        const row: TaskRow = {
          ...t,
          id,
          deferralCount: 0,
          status: 'open',
          notes: '',
          steps: [],
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
        await repo.upsertTasks([row]);
        return { ...s, tasks: [...s.tasks, row] };
      });
      return id;
    },

    setTaskDone: (id, done, date) =>
      run(
        async (s) => {
          const on = date ?? today();
          const tasks = s.tasks.map((t) => (t.id === id ? setDone(t, done, on) : t));
          await repo.upsertTasks(tasks.filter((t) => t.id === id));
          // Its linked block on that day follows.
          const blocks = s.blocks.map((b) =>
            b.date === on && b.taskId === id && isLinkedBlock(b) ? { ...b, status: done ? ('done' as const) : ('planned' as const) } : b,
          );
          if (blocks.some((b, i) => b !== s.blocks[i])) await repo.replaceBlocks([on], blocks.filter((b) => b.date === on));
          return rescore({ ...s, tasks, blocks }, on);
        },
        { replan: !date || date === today() },
      ),

    startLostDay: (reason) =>
      run(
        async (s) => {
          const day = { ...dayOf(s, today()), lostDay: true, lostDayReason: reason.trim() };
          await repo.upsertDays([day]);
          return withDay(s, day);
        },
        { replan: true },
      ),

    endLostDay: () =>
      run(
        async (s) => {
          const day = { ...dayOf(s, today()), lostDay: false };
          await repo.upsertDays([day]);
          return withDay(s, day);
        },
        { replan: true },
      ),

    setCodeRed: (on, level) =>
      run(
        async (s) => {
          const settings = { ...s.settings, codeRed: on, codeRedLevel: level ?? s.settings.codeRedLevel };
          await repo.saveSettings(settings);
          return { ...s, settings };
        },
        { replan: true },
      ),

    answerIsaac: (yes, startMin) =>
      run(
        async (s) => {
          const date = today();
          const day = { ...dayOf(s, date), isaacAnswer: yes ? ('yes' as const) : ('no' as const) };
          await repo.upsertDays([day]);
          let next = withDay(s, day);
          const def = s.events.find((e) => e.tentative);
          if (yes && def && startMin != null) {
            const friday = addDays(date, (5 - weekday(date) + 7) % 7);
            const ev = confirmTentative(def, friday, startMin, startMin + 60);
            await repo.upsertEvents([ev]);
            next = { ...next, events: [...next.events.filter((e) => e.id !== ev.id), ev] };
          }
          return next;
        },
        { replan: yes },
      ),

    saveSettings: (patch) =>
      run(
        async (s) => {
          const settings = { ...s.settings, ...patch };
          if (patch.theme) applyTheme(patch.theme);
          await repo.saveSettings(settings);
          return { ...s, settings };
        },
        { replan: !('theme' in patch && Object.keys(patch).length === 1) },
      ),

    saveEvent: (e) =>
      run(
        async (s) => {
          await repo.upsertEvents([e]);
          return { ...s, events: [...s.events.filter((x) => x.id !== e.id), e] };
        },
        { replan: true },
      ),

    deleteEvent: (id) =>
      run(
        async (s) => {
          await repo.deleteEvent(id);
          return { ...s, events: s.events.filter((x) => x.id !== id) };
        },
        { replan: true },
      ),

    savePlace: (p) =>
      run(
        async (s) => {
          await repo.upsertPlaces([p]);
          return { ...s, places: [...s.places.filter((x) => x.id !== p.id), p] };
        },
        { replan: true },
      ),

    saveVision: (v) =>
      run(async (s) => {
        await repo.saveVision(v);
        return { ...s, vision: v };
      }),

    saveContract: (patch) =>
      run(async (s) => {
        const contract = { ...s.contract, ...patch };
        await repo.saveContract(contract);
        return { ...s, contract };
      }),

    addQuote: (text, tags) =>
      run(async (s) => {
        const q: Quote = { id: crypto.randomUUID(), text: text.trim(), tags };
        await repo.upsertQuote(q);
        return { ...s, quotes: [...s.quotes, q] };
      }),

    deleteQuote: (id) =>
      run(async (s) => {
        await repo.deleteQuote(id);
        return { ...s, quotes: s.quotes.filter((q) => q.id !== id) };
      }),

    awayDays: 0,
    coachLine: null,

    async loadCoachLine() {
      const s = get().s;
      if (!s) return;
      const date = nowLocal().date;
      try {
        const cached = await repo.getCoach(date, 'daily');
        if (cached) return void set({ coachLine: cached });
        const rec = s.days[addDays(date, -1)];
        const big3 = dayOf(s, date).big3.map((i) => s.tasks.find((t) => t.id === i.taskId)?.title).filter(Boolean);
        const text = await ai.coach({
          kind: 'daily',
          name: s.contract.signedName?.split(' ')[0] || 'Eli',
          whyShort: s.vision.whyShort,
          facts: { yesterday: rec?.result ?? 'not scored', today_big3: big3, weekday: fmtDate(date).split(',')[0], away_days: get().awayDays },
        });
        if (text) {
          await repo.saveCoach(date, 'daily', text);
          set({ coachLine: text });
        }
      } catch {
        // No coach line today; Home works without it.
      }
    },

    async decideTask(id, choice, date) {
      const s = get().s;
      const t = s?.tasks.find((x) => x.id === id);
      if (!s || !t) return;
      if (choice === 'delegate') {
        set({ busy: true });
        try {
          const r = await ai.delegate({ task: { title: t.title, journey: t.journey, notes: t.notes, steps: t.steps ?? [] } });
          const notes = r.draft ? `Draft:\n${r.draft}` : t.notes;
          const row = { ...t, steps: r.steps, notes, deferralCount: 0 };
          await repo.upsertTasks([row]);
          set({ s: { ...s, tasks: s.tasks.map((x) => (x.id === id ? row : x)) } });
          await rebuild(get().s!);
          return { draft: r.draft };
        } catch (e) {
          get().showToast(`Delegate failed. ${message(e)}`, 'error');
          return;
        } finally {
          set({ busy: false });
        }
      }
      return run(
        async (cur) => {
          const today = nowLocal().date;
          let next = cur;
          if (choice === 'drop') {
            next = { ...cur, tasks: cur.tasks.map((x) => (x.id === id ? { ...x, status: 'dropped' as const } : x)) };
          } else if (choice === 'schedule') {
            next = { ...cur, tasks: cur.tasks.map((x) => (x.id === id ? { ...x, deadline: date ?? x.deadline, deferralCount: 0 } : x)) };
          } else {
            const rec = dayOf(cur, today);
            const big3 = [...rec.big3.filter((i) => i.taskId !== id && (i.locked || i.accepted)), ...rec.big3.filter((i) => i.taskId !== id && !i.locked && !i.accepted)].slice(0, 2);
            const day = { ...rec, big3: [{ taskId: id, locked: true, accepted: true }, ...big3] };
            next = withDay({ ...cur, tasks: cur.tasks.map((x) => (x.id === id ? { ...x, deferralCount: 0 } : x)) }, day);
            await repo.upsertDays([day]);
          }
          await repo.upsertTasks(next.tasks.filter((x) => x.id === id));
          return next;
        },
        { replan: true },
      );
    },

    addPhoto: (file, caption) =>
      run(async (s) => {
        const date = nowLocal().date;
        const old = s.photos.find((p) => p.date === date);
        const path = await repo.uploadPhoto(date, await shrinkPhoto(file));
        const row: PhotoRow = { date, storagePath: path, caption: caption.trim(), milestone: old?.milestone ?? false };
        await repo.savePhoto(row);
        if (old && old.storagePath !== path) await repo.deletePhoto({ ...old, date: '__old__' }).catch(() => undefined);
        photoUrlCache.delete(path);
        return { ...s, photos: [...s.photos.filter((p) => p.date !== date), row] };
      }),

    updatePhoto: (date, patch) =>
      run(async (s) => {
        const p = s.photos.find((x) => x.date === date);
        if (!p) return s;
        const row = { ...p, ...patch };
        await repo.savePhoto(row);
        return { ...s, photos: s.photos.map((x) => (x.date === date ? row : x)) };
      }),

    removePhoto: (date) =>
      run(async (s) => {
        const p = s.photos.find((x) => x.date === date);
        if (p) await repo.deletePhoto(p);
        return { ...s, photos: s.photos.filter((x) => x.date !== date) };
      }),

    async photoUrls(paths) {
      const missing = paths.filter((p) => !photoUrlCache.has(p));
      if (missing.length) {
        try {
          const urls = await repo.photoUrls(missing);
          for (const [k, v] of Object.entries(urls)) photoUrlCache.set(k, v);
        } catch {
          // Shown as empty tiles; the next open retries.
        }
      }
      return Object.fromEntries(paths.map((p) => [p, photoUrlCache.get(p) ?? '']));
    },

    async captionQuestion() {
      const s = get().s;
      if (!s) return null;
      const date = nowLocal().date;
      try {
        const cached = await repo.getCoach(date, 'caption');
        if (cached) return cached;
        const text = await ai.coach({
          kind: 'caption',
          name: s.contract.signedName?.split(' ')[0] || 'Eli',
          whyShort: s.vision.whyShort,
          facts: { identity: s.vision.identity.split('. ')[0], today_big3: dayOf(s, date).big3.map((i) => s.tasks.find((t) => t.id === i.taskId)?.title).filter(Boolean) },
        });
        if (text) await repo.saveCoach(date, 'caption', text);
        return text || null;
      } catch {
        return null;
      }
    },

    async temples() {
      const s = get().s;
      if (!s) return [];
      const now = nowLocal();
      try {
        const saved = (await repo.listReports('temple')).map((r) => r.body as SavedTemple);
        // Save any closed week from the last four that has days in it and is not saved yet.
        const thisWeek = weekStart(now.date);
        for (let k = 0; k <= 4; k++) {
          const start = addDays(thisWeek, -7 * k);
          if (!weekClosed(s, start, now) || saved.some((t) => t.weekStart === start)) continue;
          if (!Object.keys(s.days).some((d) => d >= start && d <= addDays(start, 6))) continue;
          const t = saveableTemple(s, start, now);
          await repo.saveReport('temple', start, t);
          saved.push(t);
        }
        return saved.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      } catch {
        return [];
      }
    },

    async scoutingReport(start, rewrite = false) {
      const s = get().s;
      if (!s || !weekClosed(s, start, nowLocal())) return null;
      if (!rewrite) {
        const saved = await repo.getReport('weekly', start).catch(() => null);
        if (saved) return saved as StoredReport;
      }
      const facts = weekFacts(s, start);
      const draft = draftReport(facts, s.vision.identity);
      let out: StoredReport = { facts, report: draft, source: 'draft' };
      try {
        const reply = await ai.scout({
          name: s.contract.signedName?.split(' ')[0] || 'Eli',
          whyShort: s.vision.whyShort,
          identity: s.vision.identity,
          facts: factsForCoach(facts),
          draft: { ...draft },
        });
        const report = cleanReport(reply);
        if (report) out = { facts, report, source: 'coach' };
      } catch {
        // The plain draft stands in when the coach is unavailable; it is not saved, so the next open asks again.
      }
      if (out.source === 'coach') await repo.saveReport('weekly', start, out).catch(() => undefined);
      return out;
    },

    lastDump: null,

    async dump(text) {
      const s = get().s;
      if (!s || !text.trim()) return { ok: false };
      set({ busy: true });
      try {
        const now = nowLocal();
        const out = await runDump(text.trim(), s, now, ai, recentToday(now.date));
        if (!out.ok) return { ok: false, message: out.message };
        const before = undoSnapshot(s, now.date);
        const applied = applyOps(s, out.reply, now);
        await persistDiff(s, applied.next);
        // Blocks added beyond the planned week are saved directly; the week itself is saved by the rebuild.
        const week = new Set(before.dates);
        const farDates = [...new Set(applied.next.blocks.filter((b) => b.source === 'manual' && !week.has(b.date)).map((b) => b.date))];
        for (const d of farDates) await repo.replaceBlocks([d], applied.next.blocks.filter((b) => b.date === d));
        const { s: rebuilt } = await rebuild(applied.next, applied.replanFromMin);
        const reshaped = reshapedLine(s, rebuilt, now.date, now.min);
        const done = [...applied.done, ...anchorLines(rebuilt, now.date, out.reply.ops)];
        rememberDump(now.date, { at: fmtTime(now.min), said: text.trim(), changed: applied.done });
        const logId = await repo.addOpsLog({ inputText: text.trim(), ops: out.reply.ops, unhandled: out.reply.unhandled, snapshotBefore: before });
        const farBlockIds = applied.next.blocks.filter((x) => farDates.includes(x.date) && !s.blocks.some((y) => y.id === x.id)).map((x) => x.id);
        set({ lastDump: { logId, text: text.trim(), done, reshaped, cantDo: applied.cantDo, question: applied.question, undone: false, before, farBlockIds } });
        return { ok: true };
      } catch (e) {
        return { ok: false, message: message(e) };
      } finally {
        set({ busy: false });
      }
    },

    async undoDump() {
      const s = get().s;
      const card = get().lastDump;
      if (!s || !card || card.undone) return;
      set({ busy: true });
      try {
        const b = card.before;
        const restored = restoreSnapshot(s, b, card.farBlockIds);
        await persistDiff(s, restored);
        await repo.replaceBlocks(b.dates, b.blocks);
        for (const d of [...new Set(s.blocks.filter((x) => card.farBlockIds.includes(x.id)).map((x) => x.date))]) {
          await repo.replaceBlocks([d], restored.blocks.filter((x) => x.date === d));
        }
        await repo.markUndone(card.logId);
        forgetDump(card.text);
        applyTheme(restored.settings.theme);
        set({ s: restored, lastDump: { ...card, undone: true } });
        get().showToast('Undone. Everything is back the way it was.');
      } catch (e) {
        get().showToast(`Undo failed. ${message(e)}`, 'error');
      } finally {
        set({ busy: false });
      }
    },

    dismissDump: () => set({ lastDump: null }),
  };
});

/** Save every row that differs between two snapshots (blocks are saved by the caller). */
async function persistDiff(a: Snapshot, b: Snapshot): Promise<void> {
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  if (!same(a.settings, b.settings)) await repo.saveSettings(b.settings);
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const ta = byId(a.tasks);
  const tasks = b.tasks.filter((t) => !same(ta.get(t.id), t));
  if (tasks.length) await repo.upsertTasks(tasks);
  for (const t of a.tasks) if (!b.tasks.some((x) => x.id === t.id)) await repo.deleteTask(t.id);
  const ea = byId(a.events);
  const events = b.events.filter((e) => !same(ea.get(e.id), e));
  if (events.length) await repo.upsertEvents(events);
  for (const e of a.events) if (!b.events.some((x) => x.id === e.id)) await repo.deleteEvent(e.id);
  const qa = byId(a.quotes);
  for (const q of b.quotes) if (!same(qa.get(q.id), q)) await repo.upsertQuote(q);
  for (const q of a.quotes) if (!b.quotes.some((x) => x.id === q.id)) await repo.deleteQuote(q.id);
  const days = Object.values(b.days).filter((d) => !same(a.days[d.date], d));
  if (days.length) await repo.upsertDays(days);
}
