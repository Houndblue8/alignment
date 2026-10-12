// The daily camera (Oct 12): a BeReal double shot with Chromium's fake camera.
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera'],
});

test('open the camera, take the double shot, and it goes on the roll', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The fake camera is a Chromium feature.');
  await signedWithTasks(page, '2026-10-16T10:15', []);
  await checkIn(page, '7:30');
  const card = page.getByRole('region', { name: "Today's photo" });
  await card.getByRole('button', { name: 'Open camera' }).click();
  const camera = page.getByRole('dialog', { name: 'Camera' });
  await expect(camera).toContainText('Shot 1 of 31');
  const shutter = camera.getByRole('button', { name: 'Take the photo' });
  await expect(shutter).toBeEnabled({ timeout: 10_000 });
  await shutter.click();
  await expect(card).toContainText('Click. Shot 1 of 31 is on the October roll.', { timeout: 10_000 });
  await expect(camera).toHaveCount(0);
  await card.getByLabel('One line about today').fill('Camera test.');
  await card.getByRole('button', { name: 'Save to the roll' }).click();
  await expect(card).toContainText('Shot 1 of 31 on the roll.');
});
