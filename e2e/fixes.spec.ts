// Oct 10 feedback: Big 3 items that already are on the day, late close-out, the minutes box, duplicates.
import { expect, test } from '@playwright/test';
import { checkIn, setNow, signedWithTasks } from './helpers';

test('a Big 3 item that is the workout links to it; checking either checks both', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T07:45', [{ id: 'lift', title: 'Lift', importance: 5 }]);
  await checkIn(page, '7:30');
  const item = page.getByTestId('big3-item').filter({ hasText: 'Lift' });
  await expect(item.getByTestId('big3-linked')).toContainText('Happens at Weights at the rec');
  await item.getByRole('checkbox', { name: 'Lift done' }).click();
  await page.goto('/today');
  const block = page.getByTestId('block').filter({ hasText: 'Weights at the rec' });
  await expect(block).toContainText('Big 3');
  await expect(block.getByLabel('Done')).toBeVisible();
  // No separate work block called Lift.
  await expect(page.getByTestId('block').filter({ hasText: /^Lift/ })).toHaveCount(0);
});

test('forgot to check off last night: close out yesterday at check-in and the day is scored again', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T07:45', [
    { id: 'memo', title: 'Tax memo', importance: 5 },
    { id: 'lift', title: 'Lift', importance: 5 },
  ]);
  await checkIn(page, '7:30');
  await setNow(page, '2026-10-13T07:40');
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Close out yesterday' });
  await expect(card.getByTestId('closeout-result')).toHaveText('Loss');
  await card.getByRole('checkbox', { name: 'Cold shower done' }).click();
  await card.getByRole('checkbox', { name: 'Walk with God done' }).click();
  await card.getByRole('checkbox', { name: 'Tax memo done', exact: true }).click();
  await card.getByRole('checkbox', { name: 'Lift done' }).click();
  await expect(card.getByTestId('closeout-result')).toHaveText('Win');
  // The memo is finished for good; Lift repeats, so it stays open for today.
  await card.locator('.stack', { hasText: 'Tax memo' }).getByRole('button', { name: 'Finished' }).click();
  await expect(card.getByText('Finished for good, or does it repeat?')).toHaveCount(1);
  await checkIn(page, '7:30');
  const lift = page.getByTestId('big3-item').filter({ hasText: 'Lift' });
  await expect(lift.getByRole('checkbox', { name: 'Lift done' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('big3-item').filter({ hasText: 'Tax memo' })).toHaveCount(0);
  // Still fixable later from Week.
  await page.goto('/week/2026-10-12');
  await expect(page.getByRole('region', { name: 'Close out Monday, Oct 12' }).getByTestId('closeout-result')).toHaveText('Win');
});

test('the minutes box takes the number you type, and the same task in other words is reused', async ({ page }) => {
  await signedWithTasks(page, '2026-10-12T07:45', [{ id: 'lift', title: 'Lift', importance: 2 }]);
  await page.getByRole('button', { name: 'New task' }).click();
  const minutes = page.getByRole('textbox', { name: 'Minutes' });
  await minutes.click();
  await page.keyboard.type('30');
  await expect(minutes).toHaveValue('30');
  await minutes.fill('');
  await page.keyboard.type('5');
  await expect(minutes).toHaveValue('5');
  await page.getByPlaceholder('What needs doing').fill('Lifts');
  await page.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByText('Using your existing task: Lift.')).toBeVisible();
});
