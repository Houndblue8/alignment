// The monthly recap (Appendix E 2).
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test('monthly recap: the numbers, a letter from the coach, and the vision check', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __alignmentAI: unknown }).__alignmentAI = {
      coach: async (req: { kind: string; facts: { walks_with_god: number } }) =>
        req.kind === 'month' ? `The walk held ${req.facts.walks_with_god} times. Build on it.` : 'Steady.',
    };
  });
  await signedWithTasks(page, '2026-10-12T07:45', []);
  await checkIn(page, '7:30');
  await page.goto('/week');
  await page.getByRole('link', { name: 'Monthly recap' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await expect(page.getByText('Monthly recap, so far')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Letter from your coach' })).toContainText(/The walk held \d+ times\. Build on it\./);
  const vision = page.getByRole('region', { name: 'Vision check' });
  await vision.getByRole('button', { name: 'Still fits' }).click();
  await expect(vision).toContainText('You said it still fits this month.');
  await page.getByRole('link', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { name: 'September 2026' })).toBeVisible();
  await expect(page.getByText(/Nothing counted this month/)).toBeVisible();
});
