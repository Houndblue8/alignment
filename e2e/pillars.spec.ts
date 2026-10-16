// Pillar edits (Oct 12): move or take out an item, just today or always; Settings lists the always rules.
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test('take Epic out of Faith always; it is remembered and can be forgotten in Settings', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T21:00', []);
  await checkIn(page, '7:30');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const focus = page.getByRole('region', { name: 'Focus' });
  await focus.getByRole('button', { name: /^Faith and Epic:/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Faith and Epic' });
  await sheet.getByRole('button', { name: 'Edit Epic small group' }).click();
  await sheet.getByRole('button', { name: /Take it out of Faith and Epic/ }).click();
  await expect(sheet).toContainText('Stop counting "Epic small group"');
  await sheet.getByRole('button', { name: 'Always' }).click();
  await expect(sheet.getByRole('list', { name: 'Steps today' })).not.toContainText('Epic small group');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByText('Weekly temple').click();
  const rules = page.getByRole('group', { name: 'Always rules' });
  await expect(rules).toContainText('Epic small group: never counts');
  await rules.getByRole('button', { name: 'Forget the rule for Epic small group' }).click();
  await expect(rules).toHaveCount(0);
});

test('move a step to another pillar just for today', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T21:00', []);
  await checkIn(page, '7:30');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const focus = page.getByRole('region', { name: 'Focus' });
  await focus.getByRole('button', { name: /^Faith and Epic:/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Faith and Epic' });
  await sheet.getByRole('button', { name: 'Edit Epic small group' }).click();
  await sheet.getByRole('button', { name: 'Social', exact: true }).click();
  await sheet.getByRole('button', { name: 'Just today' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(focus.getByRole('button', { name: /^Social and Community: 1 step today/ })).toBeVisible();
});
