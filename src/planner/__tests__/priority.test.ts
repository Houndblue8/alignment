// Part 14 test 7.
import { describe, expect, test } from 'vitest';
import { baseUrgency, isSchoolUrgent, needsDecision, pickBig3, priorityScore, rankTasks, urgency } from '../priority';
import { task } from './fixtures';

const TODAY = '2026-10-12';

describe('7. priority', () => {
  test('urgency by deadline', () => {
    expect(baseUrgency(null, TODAY)).toBe(1);
    expect(baseUrgency('2026-10-10', TODAY)).toBe(5); // overdue
    expect(baseUrgency('2026-10-12', TODAY)).toBe(5);
    expect(baseUrgency('2026-10-13', TODAY)).toBe(5);
    expect(baseUrgency('2026-10-14', TODAY)).toBe(4);
    expect(baseUrgency('2026-10-15', TODAY)).toBe(4);
    expect(baseUrgency('2026-10-16', TODAY)).toBe(3);
    expect(baseUrgency('2026-10-19', TODAY)).toBe(3);
    expect(baseUrgency('2026-10-20', TODAY)).toBe(2);
    expect(baseUrgency('2026-10-26', TODAY)).toBe(2);
    expect(baseUrgency('2026-10-27', TODAY)).toBe(1);
  });

  test('score = 2 x importance + urgency', () => {
    expect(priorityScore(task('a', { importance: 4, deadline: '2026-10-15' }), TODAY)).toBe(12);
    expect(priorityScore(task('b', { importance: 1 }), TODAY)).toBe(3);
  });

  test('the deferral bonus is +1 per deferral, capped at +2', () => {
    expect(urgency(task('a', { deferralCount: 1 }), TODAY)).toBe(2);
    expect(urgency(task('a', { deferralCount: 2 }), TODAY)).toBe(3);
    expect(urgency(task('a', { deferralCount: 9 }), TODAY)).toBe(3);
  });

  test('urgency never goes above 5', () => {
    expect(urgency(task('a', { deadline: '2026-10-13', deferralCount: 2 }), TODAY)).toBe(5);
    expect(urgency(task('a', { deadline: '2026-10-15', deferralCount: 2 }), TODAY)).toBe(5);
  });

  test('a School exam or deadline within 7 days outranks every Side Hustle Summit task', () => {
    const exam = task('exam', { journey: 'school', importance: 2, deadline: '2026-10-19' }); // score 7
    const shs = task('shs', { journey: 'shs', importance: 5, deadline: '2026-10-13' }); // score 15
    expect(isSchoolUrgent(exam, TODAY)).toBe(true);
    expect(rankTasks([shs, exam], TODAY).map((t) => t.id)).toEqual(['exam', 'shs']);
    const later = task('later', { journey: 'school', importance: 2, deadline: '2026-10-20' });
    expect(isSchoolUrgent(later, TODAY)).toBe(false);
    expect(rankTasks([later, shs], TODAY).map((t) => t.id)).toEqual(['shs', 'later']);
  });

  test('ranking is deterministic on ties: earlier deadline, higher importance, then id', () => {
    const a = task('a', { importance: 3, deadline: '2026-10-30' });
    const b = task('b', { importance: 3, deadline: '2026-10-29' });
    const c = task('c', { importance: 2, deadline: '2026-10-14', deferralCount: 0 });
    const d = task('d', { importance: 3 });
    const e = task('e', { importance: 3 });
    expect(rankTasks([e, d, a, b], TODAY).map((t) => t.id)).toEqual(['b', 'a', 'd', 'e']);
    expect(rankTasks([a, c], TODAY).map((t) => t.id)).toEqual(['c', 'a']);
  });

  test('Big 3 are the three highest scores', () => {
    const tasks = [task('a', { importance: 5 }), task('b', { importance: 4 }), task('c', { importance: 3 }), task('d', { importance: 2 })];
    expect(pickBig3(tasks, TODAY)).toEqual({ ids: ['a', 'b', 'c'], suggested: ['a', 'b', 'c'] });
  });

  test('a low-importance task never enters the Big 3 through deferral alone', () => {
    const tasks = [
      task('a', { importance: 3 }), // 7
      task('b', { importance: 3 }), // 7
      task('c', { importance: 3 }), // 7
      task('low', { importance: 2, deadline: '2026-10-22', deferralCount: 2 }), // 4 + 2 + 2 = 8, without deferral 6
    ];
    expect(rankTasks(tasks, TODAY)[0]!.id).toBe('low');
    expect(pickBig3(tasks, TODAY).ids).toEqual(['a', 'b', 'c']);
  });

  test('a low-importance task can still be in the Big 3 on its own merit', () => {
    const tasks = [task('a', { importance: 3 }), task('low', { importance: 2, deadline: '2026-10-12', deferralCount: 2 })];
    expect(pickBig3(tasks, TODAY).ids).toEqual(['low', 'a']);
  });

  test('locked picks stay; the automatic pick only fills empty slots', () => {
    const tasks = [task('a', { importance: 5 }), task('b', { importance: 4 }), task('c', { importance: 3 }), task('d', { importance: 1 })];
    expect(pickBig3(tasks, TODAY, ['d'])).toEqual({ ids: ['d', 'a', 'b'], suggested: ['a', 'b'] });
    expect(pickBig3(tasks, TODAY, ['c', 'gone', 'a', 'b'])).toEqual({ ids: ['c', 'a', 'b'], suggested: [] });
  });

  test('decision screen after 3 deferrals', () => {
    expect(needsDecision({ deferralCount: 2 })).toBe(false);
    expect(needsDecision({ deferralCount: 3 })).toBe(true);
  });
});
