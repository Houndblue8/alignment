import { create } from 'zustand';
import { localRepo } from '../data/localRepo';
import type { Big3Item, Contract, DayRecord, Quote, QuoteTag, Settings, Snapshot, TaskRow, Vision } from '../data/model';
import { DATA_MODE, type Repo } from '../data/repo';
import { seedSnapshot } from '../data/seedData';
import { supabaseRepo } from '../data/supabaseRepo';
import { nowLocal, type Now } from '../lib/clock';
import { addDays, confirmTentative, diffBlocks, fmtTime, weekday, type Block, type EventDef, type Place } from '../planner';
import { applyTheme } from '../theme/theme';
import { buildWeek, dayOf, fillBig3, finalizePast, suggestAgain as suggestAgainPure } from './planning';

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
  togglePin(id: string): Promise<void>;
  replan(): Promise<void>;

  setBig3(items: Big3Item[]): Promise<void>;
  acceptSuggestion(taskId: string): Promise<void>;
  suggestAgain(): Promise<void>;
  createTask(t: Pick<TaskRow, 'title' | 'journey' | 'importance' | 'estimatedMinutes' | 'deadline' | 'workType'>): Promise<string>;
  setTaskDone(id: string, done: boolean): Promise<void>;

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
}

let toastId = 0;

/** Plain-language error text for the screen. */
function message(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/fetch|network/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
  return `Something went wrong: ${m}`;
}

export const useApp = create<AppState>((set, get) => {
  /** Replace a day record in the snapshot. */
  const withDay = (s: Snapshot, d: DayRecord): Snapshot => ({ ...s, days: { ...s.days, [d.date]: d } });

  /** Re-run the planner for today and the next 6 days, save, and return how many of today's blocks changed. */
  async function rebuild(s: Snapshot): Promise<{ s: Snapshot; changed: number }> {
    const now = nowLocal();
    const before = s.blocks.filter((b) => b.date === now.date);
    const built = buildWeek(s, now);
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
            big3: big3 && big3.length ? big3 : fillBig3(s, date, rec.big3),
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

    setBlockStatus: (id, status) =>
      run(async (s) => {
        const blocks = s.blocks.map((b) => (b.id === id ? { ...b, status } : b));
        const date = s.blocks.find((b) => b.id === id)?.date;
        if (date) await repo.replaceBlocks([date], blocks.filter((b) => b.date === date));
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

    setTaskDone: (id, done) =>
      run(
        async (s) => {
          const tasks = s.tasks.map((t) =>
            t.id === id ? { ...t, status: done ? ('done' as const) : ('open' as const), completedAt: done ? new Date().toISOString() : null } : t,
          );
          await repo.upsertTasks(tasks.filter((t) => t.id === id));
          return { ...s, tasks };
        },
        { replan: true },
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
  };
});
