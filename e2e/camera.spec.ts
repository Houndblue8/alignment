// The daily camera (Oct 12): the selfie first, then the view after a 3 second countdown; and a test shot.
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera'],
});

test('selfie, a 3 second countdown, the view; it goes on the roll', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T10:15', []);
  await checkIn(page, '7:30');
  const card = page.getByRole('region', { name: "Today's photo" });
  await card.getByRole('button', { name: 'Open camera' }).click();
  const camera = page.getByRole('dialog', { name: 'Camera' });
  await expect(camera).toContainText('Shot 1 of 31');
  await expect(camera).toContainText('You first. Then the view in 3.');
  const shutter = camera.getByRole('button', { name: 'Take the photo' });
  await expect(shutter).toBeEnabled({ timeout: 10_000 });
  await shutter.click();
  await expect(camera.locator('.film-number')).toHaveText(/[123]/);
  await expect(card).toContainText('Click. Shot 1 of 31 is on the October roll.', { timeout: 15_000 });
  await card.getByLabel('One line about today').fill('Camera test.');
  await card.getByRole('button', { name: 'Save to the roll' }).click();
  await expect(card).toContainText('Shot 1 of 31 on the roll.');
});

test('a test shot is shown and never saved', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T10:15', []);
  await checkIn(page, '7:30');
  const card = page.getByRole('region', { name: "Today's photo" });
  await card.getByRole('button', { name: 'Test the camera' }).click();
  const camera = page.getByRole('dialog', { name: 'Camera' });
  await expect(camera).toContainText('Test shot, not saved');
  await expect(camera.getByRole('button', { name: 'Take the photo' })).toBeEnabled({ timeout: 10_000 });
  await camera.getByRole('button', { name: 'Take the photo' }).click();
  await expect(page.getByTestId('test-shot')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(card).toContainText("Today's photo is still open");
});
