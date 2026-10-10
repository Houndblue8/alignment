import { describe, expect, test } from 'vitest';
import { emptyDay, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import type { Block } from '../planner';
import { reshapedLine } from '../ops/apply';
import { buildingFor, buildingLine, pillarFromTitle, pillarHistory, pillarSteps } from './pillars';

const D = '2026-10-12';
const blk = (id: string, over: Partial<Block>): Block => ({
  id,
  date: D,
  start: 600,
  end: 660,
  kind: 'event',
  title: id,
  placeId: null,
  taskId: null,
  eventId: null,
  status: 'planned',
  pinned: false,
  source: 'planner',
  howto: null,
  ...over,
});
const task = (id: string, journey: TaskRow['journey'], status: TaskRow['status'] = 'open', completedAt: string | null = null): TaskRow =>
  ({ id, title: `Task ${id}`, journey, importance: 3, estimatedMinutes: 60, deadline: null, workType: 'deep', deferralCount: 0, status, notes: '', completedAt, createdAt: '2026-10-01' }) as TaskRow;

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return { ...seedSnapshot(), days: { [D]: { ...emptyDay(D), checkinDone: true } }, blocks: [], tasks: [], ...over };
}

describe('pillars', () => {
  test('anchors, Big 3, finished tasks and logged steps raise their pillars', () => {
    const s = snap({
      tasks: [task('memo', 'school'), task('call', 'life', 'done', '2026-10-12T22:00:00Z')],
      days: {
        [D]: {
          ...emptyDay(D),
          coldShower: { done: true },
          walk: { done: true },
          big3: [{ taskId: 'memo', locked: true, accepted: true, done: true }],
          steps: [{ pillar: 'shs', text: 'Sent 10 DMs' }],
        },
      },
    });
    const st = pillarSteps(s, D, { date: D, min: 700 });
    expect(st.body.map((x) => x.text)).toEqual(['Cold shower']);
    expect(st.faith.map((x) => x.text)).toEqual(['Walk with God']);
    expect(st.school.map((x) => x.text)).toEqual(['Task memo']);
    expect(st.life.map((x) => x.text)).toEqual(['Task call']);
    expect(st.shs).toEqual([{ text: 'Sent 10 DMs', source: 'logged', index: 0 }]);
    expect(st.sport).toEqual([]);
  });

  test('showing up counts once it ends unless skipped; effort blocks count only when checked', () => {
    const s = snap({
      blocks: [
        blk(`${D}:class:acct2-mon`, { kind: 'class', title: 'Accounting', eventId: 'acct2-mon', start: 720, end: 800 }),
        blk(`${D}:practice:d1-mon`, { kind: 'practice', title: 'D1 practice', eventId: 'd1-mon', start: 585, end: 705, status: 'skipped' }),
        blk(`${D}:event:epic-small-mon`, { title: 'Epic small group', eventId: 'epic-small-mon', start: 1110, end: 1200 }),
        blk(`${D}:workout:weights`, { kind: 'workout', title: 'Weights', start: 900, end: 960 }),
        blk(`${D}:misc:manual-1`, { kind: 'misc', source: 'manual', title: 'Dinner with friends', start: 1080, end: 1140 }),
      ],
    });
    const at = (min: number) => pillarSteps(s, D, { date: D, min });
    expect(at(790).school).toEqual([]);
    expect(at(800).school.map((x) => x.text)).toEqual(['Accounting']);
    expect(at(1439).sport).toEqual([]);
    expect(at(1439).faith.map((x) => x.text)).toEqual(['Epic small group']);
    expect(at(1439).life.map((x) => x.text)).toEqual(['Dinner with friends']);
    expect(at(1439).body).toEqual([]);
    s.blocks = s.blocks.map((b) => (b.kind === 'workout' ? { ...b, status: 'done' } : b));
    expect(at(1000).body.map((x) => x.text)).toEqual(['Weights']);
  });

  test('titles map to pillars by their words', () => {
    expect(pillarFromTitle('Bible study with Epic')).toBe('faith');
    expect(pillarFromTitle('Study at Whole Foods')).toBe('school');
    expect(pillarFromTitle('Dinner and hangout')).toBe('life');
    expect(pillarFromTitle('Haircut')).toBeNull();
  });

  test('the building stands when the foundation and the roof are done', () => {
    const base = snap({ tasks: [task('a', 'school', 'done')] });
    const day = base.days[D]!;
    const now = { date: D, min: 800 };
    expect(buildingLine(buildingFor(base, D, now))).toBe('Lay the foundation first: the cold shower, then the walk.');
    const half = { ...base, days: { [D]: { ...day, coldShower: { done: true } } } };
    expect(buildingLine(buildingFor(half, D, now))).toMatch(/^Half the foundation is set/);
    const laid = { ...base, days: { [D]: { ...day, coldShower: { done: true }, walk: { done: true } } } };
    expect(buildingLine(buildingFor(laid, D, now))).toBe('Foundation laid. Pick your Big 3 to raise the roof. 2 of 6 pillars rose today.');
    const all = { ...base, days: { [D]: { ...day, coldShower: { done: true }, walk: { done: true }, big3: [{ taskId: 'a', locked: true, accepted: true }] } } };
    const b = buildingFor(all, D, now);
    expect(b.complete).toBe(true);
    expect(buildingLine(b)).toBe('The building stands. That day is a Win. 3 of 6 pillars rose today.');
  });

  test('history: which of the last 7 days each pillar rose', () => {
    const s = snap({ days: { '2026-10-10': { ...emptyDay('2026-10-10'), walk: { done: true } }, [D]: { ...emptyDay(D), walk: { done: true } } } });
    const h = pillarHistory(s, { date: D, min: 600 });
    expect(h.faith.week).toEqual([false, false, false, false, true, false, true]);
    expect(h.faith.last30).toBe(2);
  });
});

describe('reshaped line', () => {
  test('names what moved into new times from now on', () => {
    const before = snap({ blocks: [blk('a', { title: 'Hangout', start: 1050, end: 1200 }), blk('b', { title: 'Misc', start: 1210, end: 1250 })] });
    const after = snap({ blocks: [blk('b', { title: 'Misc', start: 1060, end: 1100 }), blk('c', { title: 'Dinner', start: 1110, end: 1150 })] });
    expect(reshapedLine(before, after, D, 900)).toBe('Day reshaped: Misc 5:40 PM, Dinner 6:30 PM.');
    expect(reshapedLine(before, before, D, 900)).toBeNull();
  });
});
