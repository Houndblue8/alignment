import type { Block, EventDef, Place } from '../planner';
import type { Contract, DayRecord, PhotoRow, Quote, Settings, Snapshot, TaskRow, Vision } from './model';

/** Everything the app reads and writes. Two implementations: Supabase (real) and local (tests, offline dev). */
export interface Repo {
  /** Null when this account has no data yet (first run). Blocks are loaded from blocksSince onward. */
  load(blocksSince: string): Promise<Snapshot | null>;
  /** Writes the seed data. Safe to run twice: existing rows are kept. */
  seed(snapshot: Snapshot): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  saveVision(v: Vision): Promise<void>;
  saveContract(c: Contract): Promise<void>;
  upsertPlaces(p: Place[]): Promise<void>;
  upsertEvents(e: EventDef[]): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  upsertTasks(t: TaskRow[]): Promise<void>;
  deleteTask(id: string): Promise<void>;
  upsertDays(d: DayRecord[]): Promise<void>;
  /** Replace every block on these dates with the given ones. */
  replaceBlocks(dates: string[], blocks: Block[]): Promise<void>;
  upsertQuote(q: Quote): Promise<void>;
  deleteQuote(id: string): Promise<void>;
  /** Log a talk box dump with what it changed and the state before, for Undo. Returns the log id. */
  addOpsLog(entry: OpsLogEntry): Promise<string>;
  markUndone(id: string): Promise<void>;
  /** Cached coach text per day (one AI call per day for the Home line). */
  getCoach(date: string, kind: string): Promise<string | null>;
  saveCoach(date: string, kind: string, text: string): Promise<void>;
  /** Weekly scouting reports and monthly recaps, by the period's first day. */
  getReport(type: ReportType, periodStart: string): Promise<unknown | null>;
  saveReport(type: ReportType, periodStart: string, body: unknown): Promise<void>;
  /** Upload the day's photo file; returns its storage path. */
  uploadPhoto(date: string, file: Blob): Promise<string>;
  savePhoto(p: PhotoRow): Promise<void>;
  deletePhoto(p: PhotoRow): Promise<void>;
  /** Short-lived viewing links for stored photos, by storage path. */
  photoUrls(paths: string[]): Promise<Record<string, string>>;
}

export type ReportType = 'weekly' | 'monthly';

export interface OpsLogEntry {
  inputText: string;
  ops: unknown[];
  unhandled: unknown[];
  snapshotBefore: unknown;
}

export const DATA_MODE: 'local' | 'supabase' = import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'supabase';
