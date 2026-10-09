import type { Block, EventDef, Place } from '../planner';
import type { Contract, DayRecord, Quote, Settings, Snapshot, TaskRow, Vision } from './model';

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
}

export const DATA_MODE: 'local' | 'supabase' = import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'supabase';
