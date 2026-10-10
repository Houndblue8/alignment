// A day's blocks with the spacing rules: no overlaps, drive time between places,
// and a 5 minute buffer between blocks at the same place unless a block opts out.
import { travel } from './places';
import { RULES } from './rules';
import { ceil5 } from './time';
import type { Block, Place } from './types';

export interface Spacing {
  /** No buffer needed before the next block (morning routine chain). */
  chainAfter?: boolean;
  /** No buffers on either side (a squeezed meal). */
  tight?: boolean;
}

export const HOME = 'home';

export class Timeline {
  private items: Block[] = [];
  private spacing = new Map<string, Spacing>();

  constructor(
    private readonly places: Place[],
    /** Nothing new is placed before this. */
    readonly dayStart: number,
  ) {}

  get blocks(): readonly Block[] {
    return this.items;
  }

  get(id: string): Block | undefined {
    return this.items.find((b) => b.id === id);
  }

  add(b: Block, s: Spacing = {}): void {
    this.items.push(b);
    this.spacing.set(b.id, s);
    this.items.sort((x, y) => x.start - y.start || x.end - y.end || (x.id < y.id ? -1 : 1));
  }

  /** Change a placed block without moving it (for example, linking it to a task). */
  patch(id: string, patch: Partial<Block>): void {
    this.items = this.items.map((b) => (b.id === id ? { ...b, ...patch, id: b.id, start: b.start, end: b.end } : b));
  }

  remove(id: string): void {
    this.items = this.items.filter((b) => b.id !== id);
    this.spacing.delete(id);
  }

  /** Minutes needed between a (earlier) and b (later). */
  gap(a: Block, sa: Spacing, b: Block, sb: Spacing): number {
    const t = travel(this.places, a.placeId ?? HOME, b.placeId ?? HOME);
    if (t > 0) return t;
    if (sa.chainAfter || sa.tight || sb.tight) return 0;
    return RULES.bufferMin;
  }

  overlapping(start: number, end: number): Block | undefined {
    return this.items.find((x) => start < x.end && x.start < end);
  }

  canPlace(b: Block, s: Spacing = {}): boolean {
    if (b.end <= b.start) return false;
    if (this.overlapping(b.start, b.end)) return false;
    let prev: Block | undefined;
    let next: Block | undefined;
    for (const x of this.items) {
      if (x.end <= b.start && (!prev || x.end > prev.end || (x.end === prev.end && x.start > prev.start))) prev = x;
      if (x.start >= b.end && (!next || x.start < next.start)) next = x;
    }
    if (prev && b.start - prev.end < this.gap(prev, this.spacing.get(prev.id) ?? {}, b, s)) return false;
    if (!prev && b.start - this.dayStart < travel(this.places, HOME, b.placeId ?? HOME)) return false;
    if (next && next.start - b.end < this.gap(b, s, next, this.spacing.get(next.id) ?? {})) return false;
    return true;
  }

  /** Earliest start in [lo, hi - len] on the 5 minute grid where the block fits. */
  find(make: (start: number, len: number) => Block, len: number, lo: number, hi: number, s: Spacing = {}): number | null {
    for (let t = ceil5(Math.max(lo, this.dayStart)); t + len <= hi; t += 5) {
      if (this.canPlace(make(t, len), s)) return t;
    }
    return null;
  }

  /** Earliest start with the longest length in [minLen, maxLen] that fits there. */
  findFlex(
    make: (start: number, len: number) => Block,
    minLen: number,
    maxLen: number,
    lo: number,
    hi: number,
    s: Spacing = {},
  ): { start: number; len: number } | null {
    const lens = lengths(minLen, maxLen);
    for (let t = ceil5(Math.max(lo, this.dayStart)); t + minLen <= hi; t += 5) {
      for (const len of lens) {
        if (t + len <= hi && this.canPlace(make(t, len), s)) return { start: t, len };
      }
    }
    return null;
  }
}

/** maxLen, then 5 minute steps down, then minLen. */
export function lengths(minLen: number, maxLen: number): number[] {
  const out = [maxLen];
  for (let l = Math.floor(maxLen / 5) * 5; l > minLen; l -= 5) if (l < maxLen) out.push(l);
  if (minLen < maxLen) out.push(minLen);
  return out;
}
