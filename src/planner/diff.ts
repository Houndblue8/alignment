import type { Block } from './types';

export interface BlockChange {
  id: string;
  title: string;
  before?: Pick<Block, 'start' | 'end'>;
  after?: Pick<Block, 'start' | 'end'>;
}

export interface BlockDiff {
  added: BlockChange[];
  removed: BlockChange[];
  /** Same length, new start. */
  moved: BlockChange[];
  /** Length changed (start may also change). */
  resized: BlockChange[];
  /** Total number of changed blocks. */
  count: number;
}

/** Compare two block lists by id. Travel blocks are ignored: they follow the blocks around them. */
export function diffBlocks(before: Block[], after: Block[]): BlockDiff {
  const keep = (b: Block) => b.kind !== 'travel';
  const prev = new Map(before.filter(keep).map((b) => [b.id, b]));
  const next = new Map(after.filter(keep).map((b) => [b.id, b]));
  const d: BlockDiff = { added: [], removed: [], moved: [], resized: [], count: 0 };
  for (const [id, b] of next) {
    const a = prev.get(id);
    if (!a) {
      d.added.push({ id, title: b.title, after: { start: b.start, end: b.end } });
    } else if (a.end - a.start !== b.end - b.start) {
      d.resized.push({ id, title: b.title, before: { start: a.start, end: a.end }, after: { start: b.start, end: b.end } });
    } else if (a.start !== b.start) {
      d.moved.push({ id, title: b.title, before: { start: a.start, end: a.end }, after: { start: b.start, end: b.end } });
    }
  }
  for (const [id, a] of prev) {
    if (!next.has(id)) d.removed.push({ id, title: a.title, before: { start: a.start, end: a.end } });
  }
  const byStart = (x: BlockChange, y: BlockChange) => (x.after ?? x.before)!.start - (y.after ?? y.before)!.start || (x.id < y.id ? -1 : 1);
  d.added.sort(byStart);
  d.removed.sort(byStart);
  d.moved.sort(byStart);
  d.resized.sort(byStart);
  d.count = d.added.length + d.removed.length + d.moved.length + d.resized.length;
  return d;
}
