// Daily photo ritual and the Memory page (Phase 5, Appendix E 1).
import { expect, test } from '@playwright/test';
import { checkIn, setNow, signedWithTasks } from './helpers';

// A tiny valid PNG (4 x 4 gold pixels).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGO4ospgeYUBiYFQBQBaKAkxhDQfIgAAAABJRU5ErkJggg==',
  'base64',
);

test('add today\'s photo with a caption any time of day; Memory shows it and keeps milestones', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __alignmentAI: unknown }).__alignmentAI = {
      coach: async () => 'What did you choose today that the old you would have skipped?',
    };
  });
  await signedWithTasks(page, '2026-10-16T10:15', []);
  await checkIn(page, '7:30');

  const card = page.getByRole('region', { name: "Today's photo" });
  await expect(card).toContainText("Today's photo is still open");
  await page.getByTestId('photo-input').setInputFiles({ name: 'today.png', mimeType: 'image/png', buffer: PNG });
  await expect(card).toContainText('What did you choose today that the old you would have skipped?');
  await card.getByLabel('One line about today').fill('First day of the new routine.');
  await card.getByRole('button', { name: 'Save photo' }).click();
  await expect(card).toContainText('First day of the new routine.');
  await expect(card.locator('img.photo-thumb')).toBeVisible();

  await card.getByRole('link', { name: 'Memory' }).click();
  await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Then and now' }).getByRole('button', { name: /Day 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Friday, Oct 16', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Milestone day' }).check();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Friday, Oct 16, milestone' })).toBeVisible();

  // Next day: yesterday keeps its photo; today is open again.
  await setNow(page, '2026-10-17T09:00');
  await page.goto('/');
  await checkIn(page, '7:30');
  await expect(page.getByRole('region', { name: "Today's photo" })).toContainText("Today's photo is still open");
  await page.goto('/memory');
  await expect(page.getByRole('button', { name: 'Friday, Oct 16, milestone' })).toBeVisible();
});

test('a past day without a photo shows the missed marker and keeps its score', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  await setNow(page, '2026-10-17T08:00');
  await page.goto('/');
  await checkIn(page, '7:30');
  await page.goto('/memory');
  await expect(page.getByLabel('Friday, Oct 16, missed photo')).toBeVisible();
});
