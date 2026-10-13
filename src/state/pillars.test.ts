import { describe, expect, test } from 'vitest';
import { emptyDay, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import type { Block } from '../planner';
import { reshapedLine } from '../ops/apply';
import { pillarFromTitle, pillarHistory, pillarSteps } from './pillars';

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
  const texts = (st: { text: string }[]) => st.map((x) => x.text);

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
    expect(texts(st.body)).toEqual(['Cold shower']);
    expect(texts(st.faith)).toEqual(['Walk with God']);
    expect(texts(st.school)).toEqual(['Task memo']);
    expect(texts(st.life)).toEqual(['Task call']);
    expect(st.shs).toEqual([{ text: 'Sent 10 DMs', source: 'logged', index: 0, key: 'logged:0' }]);
    expect(st.sport).toEqual([]);
  });

  test('classes never count; practices and workouts are Athletics sessions once they happen; effort counts when checked', () => {
    const s = snap({
      blocks: [
        blk(`${D}:class:acct2-mon`, { kind: 'class', title: 'Accounting', eventId: 'acct2-mon', start: 720, end: 800 }),
        blk(`${D}:practice:d1-mon`, { kind: 'practice', title: 'D1 practice', eventId: 'd1-mon', start: 585, end: 705 }),
        blk(`${D}:event:epic-small-mon`, { title: 'Epic small group', eventId: 'epic-small-mon', start: 1110, end: 1200 }),
        blk(`${D}:workout:weights`, { kind: 'workout', title: 'Weights', start: 900, end: 960 }),
        blk(`${D}:misc:manual-1`, { kind: 'misc', source: 'manual', title: 'Dinner with friends', start: 1080, end: 1140 }),
        blk(`${D}:misc:1`, { kind: 'misc', title: 'Misc', start: 1210, end: 1250 }),
      ],
    });
    const at = (min: number) => pillarSteps(s, D, { date: D, min });
    expect(at(1439).school).toEqual([]);
    expect(at(700).sport).toEqual([]);
    expect(at(1439).sport.map((x) => [x.text, x.session])).toEqual([
      ['D1 practice', true],
      ['Weights', true],
    ]);
    expect(texts(at(1439).faith)).toEqual(['Epic small group']);
    expect(texts(at(1439).life)).toEqual(['Dinner with friends']);
    // Planner misc time is Stewardship, and only once it is checked.
    expect(at(1439).body).toEqual([]);
    s.blocks = s.blocks.map((b) => (b.id === `${D}:misc:1` ? { ...b, status: 'done' } : b));
    expect(texts(at(1439).body)).toEqual(['Errands and catch-up']);
  });

  test('a Big 3 item that is a block on the schedule counts once, under its Big 3 name', () => {
    const s = snap({
      tasks: [task('lift', 'sport')],
      days: { [D]: { ...emptyDay(D), checkinDone: true, big3: [{ taskId: 'lift', locked: true, accepted: true, done: true }] } },
      blocks: [blk(`${D}:workout:weights`, { kind: 'workout', title: 'Weights at the rec', taskId: 'lift', start: 900, end: 960 })],
    });
    const st = pillarSteps(s, D, { date: D, min: 1000 });
    expect(st.sport.map((x) => [x.text, x.key])).toEqual([['Task lift', 'task:lift']]);
    // Not checked yet but the workout happened: still one step, still the Big 3 name, and a session.
    s.days[D] = { ...s.days[D]!, big3: [{ taskId: 'lift', locked: true, accepted: true }] };
    expect(pillarSteps(s, D, { date: D, min: 1000 }).sport.map((x) => [x.text, x.session])).toEqual([['Task lift', true]]);
  });

  test('edits: move or take out for one day, or always (a rule)', () => {
    const s = snap({ blocks: [blk(`${D}:event:epic-small-mon`, { title: 'Epic small group', eventId: 'epic-small-mon', start: 600, end: 660 })] });
    const night = { date: D, min: 1400 };
    s.days[D] = { ...s.days[D]!, stepEdits: [{ key: 'event:epic-small-mon', pillar: 'life' }] };
    expect(texts(pillarSteps(s, D, night).life)).toEqual(['Epic small group']);
    expect(pillarSteps(s, D, night).faith).toEqual([]);
    // Always: never count it. A today edit still wins for that day.
    s.settings = { ...s.settings, pillarRules: [{ key: 'event:epic-small-mon', pillar: null, label: 'Epic small group' }] };
    expect(texts(pillarSteps(s, D, night).life)).toEqual(['Epic small group']);
    s.days[D] = { ...s.days[D]!, stepEdits: [] };
    expect(Object.values(pillarSteps(s, D, night)).flat()).toEqual([]);
  });

  test('titles map to pillars by their words', () => {
    expect(pillarFromTitle('Bible study with Epic')).toBe('faith');
    expect(pillarFromTitle('Study at Whole Foods')).toBe('school');
    expect(pillarFromTitle('Dinner and hangout')).toBe('life');
    expect(pillarFromTitle('Do laundry')).toBe('body');
    expect(pillarFromTitle('Lift at the rec')).toBe('sport');
    expect(pillarFromTitle('Haircut')).toBe('body');
    expect(pillarFromTitle('Something else')).toBeNull();
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
