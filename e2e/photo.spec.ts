// Daily photo ritual and the Memory page (Phase 5, Appendix E 1).
import { expect, test } from '@playwright/test';
import { checkIn, setNow, signedWithTasks } from './helpers';

// A tiny valid PNG (4 x 4 gold pixels).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGO4ospgeYUBiYFQBQBaKAkxhDQfIgAAAABJRU5ErkJggg==',
  'base64',
);

test("a shot goes on the month's roll, hidden until the month is over; then Memory and the recap develop it", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __alignmentAI: unknown }).__alignmentAI = {
      coach: async () => 'What did you choose today that the old you would have skipped?',
    };
  });
  await signedWithTasks(page, '2026-10-16T10:15', []);
  await checkIn(page, '7:30');

  const card = page.getByRole('region', { name: "Today's photo" });
  await expect(card).toContainText("Today's photo is still open");
  // The library path (the camera itself is covered in camera.spec.ts).
  await page.getByTestId('photo-input').setInputFiles({ name: 'today.png', mimeType: 'image/png', buffer: PNG });
  await expect(card).toContainText('Click. Shot 1 of 31 is on the October roll.');
  await expect(card).toContainText('What did you choose today that the old you would have skipped?');
  await card.getByLabel('One line about today').fill('First day of the new routine.');
  await card.getByRole('button', { name: 'Save to the roll' }).click();
  await expect(card).toContainText('Shot 1 of 31 on the roll. Develops November 1.');
  await expect(card).toContainText('First day of the new routine.');
  await expect(card.locator('img')).toHaveCount(0);

  await card.getByRole('link', { name: 'Memory' }).click();
  await expect(page.getByRole('region', { name: 'On the roll' })).toContainText('1 shot on the October roll.');
  await expect(page.getByLabel('Friday, Oct 16, on the roll')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Then and now' })).toHaveCount(0);

  // November 2: the October roll has developed.
  await setNow(page, '2026-11-02T09:00');
  await page.goto('/');
  await checkIn(page, '7:30');
  await page.goto('/memory');
  await expect(page.getByRole('region', { name: 'Then and now' }).getByRole('button', { name: /Day 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: 'Friday, Oct 16', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Milestone day' }).check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Friday, Oct 16, milestone' })).toBeVisible();
  await page.goto('/recap/2026-10');
  await expect(page.getByRole('region', { name: 'Photo timeline' }).locator('img')).toHaveCount(1);
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
