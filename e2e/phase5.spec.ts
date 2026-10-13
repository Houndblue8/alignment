// The urge button (Appendix E 5) and the monthly recap (Appendix E 2).
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test('urge button: avoiding shrinks the most pushed-off task to a 5 minute start; tired offers a walk that counts for Stewardship', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T14:00', [
    { id: 'memo', title: 'Tax memo', importance: 5, deferralCount: 3 } as never,
    { id: 'dms', title: 'Send DMs', importance: 3, estimatedMinutes: 20 },
  ]);
  await checkIn(page, '7:30');
  await page.getByRole('button', { name: 'Bored, avoiding, or tired?' }).click();
  await page.getByRole('button', { name: /^Avoiding Shrink/ }).click();
  const avoiding = page.getByTestId('urge-avoiding');
  await expect(avoiding).toContainText('Tax memo');
  await expect(avoiding).toContainText('Pushed off 3 times.');
  await expect(avoiding).toContainText('5 minute start: Open it and write one rough sentence.');
  await page.getByRole('button', { name: 'Start 5 minutes' }).click();
  await expect(page.getByTestId('urge-timer')).toContainText(/4:5\d|5:00/);
  await page.getByRole('button', { name: 'Stop here' }).click();

  await page.getByRole('button', { name: 'Bored, avoiding, or tired?' }).click();
  await page.getByRole('button', { name: /^Tired A short/ }).click();
  await expect(page.getByTestId('urge-tired')).toContainText('Send DMs');
  await page.getByRole('button', { name: /A 10 minute walk/ }).click();
  await page.getByRole('button', { name: 'Stop here' }).click();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Focus' }).getByRole('button', { name: /^Stewardship: 1 step today/ })).toBeVisible();

  await page.getByRole('button', { name: 'Bored, avoiding, or tired?' }).click();
  await page.getByRole('button', { name: /^Bored Something/ }).click();
  await expect(page.getByTestId('urge-bored')).toBeVisible();
  await page.getByRole('button', { name: 'Another' }).click();
  await page.getByRole('button', { name: 'Back to it' }).click();
});

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
