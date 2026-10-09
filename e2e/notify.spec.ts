// Notifications (Phase 5): settings, and the in-app fallback when push is not on.
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test('without push, the morning reminder shows inside the app at the wake time', async ({ page }) => {
  // The wake target is 6:30 AM; at 6:31 with no check-in the reminder is due.
  await signedWithTasks(page, '2026-10-16T06:31', []);
  await expect(page.getByTestId('toast')).toContainText('Good morning. Cold shower, then the walk with God.');
});

test('notification settings: state is explained and preferences persist', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
  await page.getByText('Notifications', { exact: true }).click();
  await expect(page.locator('.banner').filter({ hasText: /notifications|Notifications/ }).first()).toBeVisible();
  const blocks = page.getByRole('checkbox', { name: '5 minutes before each block' });
  await expect(blocks).not.toBeChecked();
  await blocks.check();
  await page.reload();
  await page.getByText('Notifications', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '5 minutes before each block' })).toBeChecked();
});
