// Browser-only data store. Used by end-to-end tests and for running the app without a backend.
import type { Repo } from './repo';
import type { Snapshot } from './model';

const KEY = 'alignment.localdb';

function read(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function write(s: Snapshot): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function update(fn: (s: Snapshot) => void): Promise<void> {
  const s = read();
  if (!s) return Promise.reject(new Error('No data yet.'));
  fn(s);
  write(s);
  return Promise.resolve();
}

const upsertById = <T extends { id: string }>(list: T[], items: T[]): T[] => {
  const map = new Map(list.map((x) => [x.id, x]));
  for (const i of items) map.set(i.id, i);
  return [...map.values()];
};

export const localRepo: Repo = {
  load: async () => {
    const s = read();
    return s ? { ...s, photos: s.photos ?? [] } : null;
  },
  seed: async (snapshot) => {
    if (!read()) write(snapshot);
  },
  saveSettings: (v) => update((s) => void (s.settings = v)),
  saveVision: (v) => update((s) => void (s.vision = v)),
  saveContract: (v) => update((s) => void (s.contract = v)),
  upsertPlaces: (p) => update((s) => void (s.places = upsertById(s.places, p))),
  upsertEvents: (e) => update((s) => void (s.events = upsertById(s.events, e))),
  deleteEvent: (id) => update((s) => void (s.events = s.events.filter((e) => e.id !== id))),
  upsertTasks: (t) => update((s) => void (s.tasks = upsertById(s.tasks, t))),
  deleteTask: (id) => update((s) => void (s.tasks = s.tasks.filter((t) => t.id !== id))),
  upsertDays: (d) =>
    update((s) => {
      for (const day of d) s.days[day.date] = day;
    }),
  replaceBlocks: (dates, blocks) =>
    update((s) => {
      s.blocks = [...s.blocks.filter((b) => !dates.includes(b.date)), ...blocks];
    }),
  upsertQuote: (q) => update((s) => void (s.quotes = upsertById(s.quotes, [q]))),
  deleteQuote: (id) => update((s) => void (s.quotes = s.quotes.filter((q) => q.id !== id))),
  addOpsLog: async (entry) => {
    const id = crypto.randomUUID();
    const log = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as unknown[];
    log.push({ id, createdAt: new Date().toISOString(), undone: false, ...entry });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-50)));
    return id;
  },
  markUndone: async (id) => {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as { id: string; undone: boolean }[];
    localStorage.setItem(LOG_KEY, JSON.stringify(log.map((e) => (e.id === id ? { ...e, undone: true } : e))));
  },
  getCoach: async (date, kind) => (JSON.parse(localStorage.getItem(COACH_KEY) ?? '{}') as Record<string, string>)[`${date}:${kind}`] ?? null,
  saveCoach: async (date, kind, text) => {
    const all = JSON.parse(localStorage.getItem(COACH_KEY) ?? '{}') as Record<string, string>;
    all[`${date}:${kind}`] = text;
    localStorage.setItem(COACH_KEY, JSON.stringify(all));
  },
  getReport: async (type, periodStart) => (JSON.parse(localStorage.getItem(REPORT_KEY) ?? '{}') as Record<string, unknown>)[`${type}:${periodStart}`] ?? null,
  listReports: async (type) =>
    Object.entries(JSON.parse(localStorage.getItem(REPORT_KEY) ?? '{}') as Record<string, unknown>)
      .filter(([k]) => k.startsWith(`${type}:`))
      .map(([k, body]) => ({ periodStart: k.slice(type.length + 1), body }))
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
  saveReport: async (type, periodStart, body) => {
    const all = JSON.parse(localStorage.getItem(REPORT_KEY) ?? '{}') as Record<string, unknown>;
    all[`${type}:${periodStart}`] = body;
    localStorage.setItem(REPORT_KEY, JSON.stringify(all));
  },
  // Local test mode keeps photos as data URLs in the browser (small test images only).
  uploadPhoto: async (date, file) => {
    const path = `local/${date}.jpg`;
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    localStorage.setItem(`alignment.photo.${path}`, url);
    return path;
  },
  savePhoto: (p) =>
    update((s) => {
      s.photos = [...(s.photos ?? []).filter((x) => x.date !== p.date), p];
    }),
  deletePhoto: async (p) => {
    localStorage.removeItem(`alignment.photo.${p.storagePath}`);
    await update((s) => void (s.photos = (s.photos ?? []).filter((x) => x.date !== p.date)));
  },
  photoUrls: async (paths) => Object.fromEntries(paths.map((p) => [p, localStorage.getItem(`alignment.photo.${p}`) ?? ''])),
};

const LOG_KEY = 'alignment.opslog';
const COACH_KEY = 'alignment.coach';
const REPORT_KEY = 'alignment.reports';
