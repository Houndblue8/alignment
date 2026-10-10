// Part 14 UI tests 20 to 23.
import { expect, test } from '@playwright/test';
import { checkIn, fresh, setNow, signedWithTasks } from './helpers';

test('20. first launch shows the Contract; signing shows the signature, then the app moves on', async ({ page }) => {
  await fresh(page, '2026-10-12T07:45');
  await expect(page.getByText('Contract to Self')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(5);
  await page.getByLabel('Type your full name to sign').fill('Eli Test');
  await page.getByRole('button', { name: 'Sign' }).click();
  await expect(page.getByTestId('signature')).toContainText('Eli Test');
  // First launch is also the first open of the day, so the check-in comes next, then Home.
  await expect(page.getByRole('heading', { name: 'What time did you wake up?' })).toBeVisible({ timeout: 5000 });
  await checkIn(page);
  await expect(page.getByRole('link', { name: /Focus view: \d of \d done/ })).toBeVisible();
  // The contract never shows again.
  await page.reload();
  await expect(page.getByText('Contract to Self')).toHaveCount(0);
});

test('21. each new day starts at the Morning check-in; Build my day opens Home with the plan', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T07:45', []);
  await checkIn(page, '7:30');
  await expect(page.getByTestId('bedtime')).toHaveText('Tonight: bed by 11:15 PM, wake at 7:15 AM');

  await setNow(page, '2026-10-13T07:20');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What time did you wake up?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cold shower' }).click();
  await checkIn(page, 'Just now');
  await page.getByRole('link', { name: 'Today' }).click();
  const timeline = page.getByTestId('timeline');
  await expect(timeline.getByText('BUS 3302')).toBeVisible();
  // Wake 7:20, cold shower done: it shows done at 7:25, never at a fixed clock time.
  await expect(timeline.getByText('7:25 AM')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cold shower Done', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('22. Big 3: remove one, add another, reload, the choice persists', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T07:30', [
    { id: 't1', title: 'Launch page', importance: 5 },
    { id: 't2', title: 'Sales email', importance: 4 },
    { id: 't3', title: 'Course outline', importance: 4 },
    { id: 't4', title: 'Inbox cleanup', importance: 3 },
  ]);
  // The check-in offers the top 3; Eli swaps one before building the day.
  await expect(page.getByRole('heading', { name: "Today's Big 3" })).toBeVisible();
  await expect(page.getByText('3 of 3')).toBeVisible();
  await page.getByRole('button', { name: /Course outline/ }).click();
  await expect(page.getByText('2 of 3')).toBeVisible();
  await page.getByRole('button', { name: /Course outline/ }).click();
  await checkIn(page);
  const items = page.getByTestId('big3-item');
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText('Launch page');

  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByRole('button', { name: 'Remove Sales email' }).click();
  await page.getByRole('button', { name: 'Add Inbox cleanup' }).click();
  await page.getByRole('button', { name: 'Move Inbox cleanup up' }).click();
  await page.getByRole('button', { name: 'Save Big 3' }).click();

  const expected = ['Launch page', 'Inbox cleanup', 'Course outline'];
  await expect(items).toHaveCount(3);
  for (const [i, t] of expected.entries()) await expect(items.nth(i)).toContainText(t);

  await page.reload();
  await expect(items).toHaveCount(3);
  for (const [i, t] of expected.entries()) await expect(items.nth(i)).toContainText(t);
  // Picked by hand: locked, never "Suggested".
  for (let i = 0; i < 3; i++) await expect(items.nth(i)).not.toContainText('Suggested');
});

test('23. Replan shows the toast and updates blocks', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T07:30', [{ id: 't1', title: 'Launch page', importance: 5, estimatedMinutes: 120 }]);
  await checkIn(page, '7:30');
  await page.getByRole('link', { name: 'Today' }).click();
  const timeline = page.getByTestId('timeline');
  await expect(timeline.getByText('Launch page').first()).toBeVisible();

  // Two hours later, nothing marked done: Replan rebuilds from 10:15 AM.
  await setNow(page, '2026-10-16T10:12');
  await page.getByRole('button', { name: 'Replan' }).click();
  await expect(page.getByTestId('toast')).toHaveText(/^Replanned from 10:15 AM\. \d+ blocks? changed\.$/);
  await expect(timeline.getByText('Cold shower')).toBeVisible();
  const firstWalk = timeline.locator('[id$=":anchor_walk:1"] .tl-time');
  await expect(firstWalk).toHaveText(/1[0-2]:\d\d [AP]M/);

  // Replanning again right away changes nothing.
  await page.getByRole('button', { name: 'Replan' }).click();
  await expect(page.getByTestId('toast')).toHaveText('Nothing needed to change.');
});
