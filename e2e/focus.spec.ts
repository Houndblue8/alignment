// Focus view (the building), one-tap Cancelled, and talk box follow-ups (Oct 10 feedback).
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test('the building: foundation, pillars and roof rise as the day goes; tap a pillar to log a step', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T07:45', [{ id: 'memo', title: 'Tax memo', importance: 5 }]);
  await checkIn(page, '7:30');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const focus = page.getByRole('region', { name: 'Focus' });
  await expect(focus.getByTestId('focus-line')).toHaveText('Lay the foundation first: the cold shower, then the walk.');

  await page.getByRole('button', { name: 'Cold shower Not yet' }).click();
  await page.getByRole('button', { name: 'Walk with God Not yet' }).click();
  await expect(focus.getByTestId('focus-line')).toHaveText('Foundation laid. Now raise the roof: your Big 3. 2 of 6 pillars rose today.');

  await focus.getByRole('button', { name: 'Social and Community: 0 steps today' }).click();
  await page.getByRole('button', { name: 'Called family' }).click();
  await expect(page.getByRole('list', { name: 'Steps today' })).toContainText('Called family');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(focus.getByRole('button', { name: 'Social and Community: 1 step today' })).toBeVisible();

  await page.getByRole('checkbox', { name: 'Tax memo done' }).click();
  await expect(focus.getByTestId('focus-line')).toHaveText('The building stands. That day is a Win. 4 of 6 pillars rose today.');
});

test('plans changed: Cancelled frees the time and the day rebuilds around it', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T07:45', [{ id: 'memo', title: 'Tax memo', importance: 5, estimatedMinutes: 120 }]);
  await checkIn(page, '7:30');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const practice = page.getByTestId('block').filter({ hasText: 'D1 practice' });
  await practice.click();
  await page.getByRole('button', { name: 'Cancelled' }).click();
  await expect(page.getByText(/D1 practice cancelled\./)).toBeVisible();
  await expect(page.getByTestId('block').filter({ hasText: 'D1 practice' })).toHaveCount(0);
  // Only this Monday: next Monday still has practice.
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('alignment.localdb')!));
  expect(db.events.find((e: { id: string }) => e.id === 'd1-mon').skipDates).toEqual(['2026-10-12']);
});

test('talk box follow-up: "that got cancelled" knows what "that" was and reshapes the day', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __aiCalls: { context: { recent_messages: { said: string }[]; today: { blocks: { id: string; title: string }[] } } }[]; __alignmentAI: unknown };
    w.__aiCalls = [];
    w.__alignmentAI = {
      parse: async (req: { text: string; context: { now: { date: string }; recent_messages: { said: string }[]; today: { blocks: { id: string; title: string }[] } } }) => {
        w.__aiCalls.push(req as never);
        if (req.text.startsWith('hangout')) {
          return {
            ops: [{ op: 'add_block', source_text: req.text, title: 'Hangout with Josh', date: req.context.now.date, start: '13:00', end: '15:00', location: null }],
            unhandled: [],
            summary: 'Added.',
          };
        }
        const said = req.context.recent_messages.at(-1)?.said ?? '';
        const target = req.context.today.blocks.find((b) => said.startsWith('hangout') && b.title === 'Hangout with Josh');
        return target
          ? { ops: [{ op: 'delete_block', source_text: req.text, block_id: target.id }], unhandled: [], summary: 'Cancelled the hangout.' }
          : { ops: [], unhandled: [], summary: 'Not sure what got cancelled.' };
      },
    };
  });
  await signedWithTasks(page, '2026-10-17T08:30', [{ id: 'memo', title: 'Tax memo', importance: 5, estimatedMinutes: 300 }]);
  await checkIn(page, '7:30');
  await page.getByRole('button', { name: /Open the talk box/ }).click();
  await page.getByTestId('talk-input').fill('hangout with Josh 1 to 3');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('result-card')).toContainText('Added Hangout with Josh');
  await page.getByTestId('talk-input').fill('that got cancelled');
  await page.getByRole('button', { name: 'Send' }).click();
  const card = page.getByTestId('result-card');
  await expect(card).toContainText('Hangout with Josh taken off today.');
  await expect(card.getByTestId('reshaped')).toContainText('Day reshaped:');
  const calls = await page.evaluate(() => (window as unknown as { __aiCalls: { context: { recent_messages: { said: string }[] } }[] }).__aiCalls);
  expect(calls[1]!.context.recent_messages.map((m) => m.said)).toEqual(['hangout with Josh 1 to 3']);
});
