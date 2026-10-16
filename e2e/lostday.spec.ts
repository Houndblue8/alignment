// The Lost Day (Oct 16): the Big 3 set aside for one faith focus, a page about the fire, and a purple fire.
// The evening recap after 9 PM.
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test('a Lost Day: one faith focus, the foundation and a surrender light the purple fire; ending it brings the Big 3 back', async ({ page }) => {
  await signedWithTasks(page, '2026-10-19T15:00', [{ id: 'memo', title: 'Tax memo', importance: 5 }]);
  await checkIn(page, '7:30');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Day options' }).click();
  await page.getByRole('menuitem', { name: 'Start Lost Day' }).click();
  await expect(page.getByRole('heading', { name: 'The day got away. It is not over.' })).toBeVisible();
  await page.getByLabel(/What happened/).fill('Did not study at all');
  await page.getByRole('button', { name: 'Be intentional at Epic small group' }).click();
  await page.getByRole('button', { name: 'Start Lost Day' }).click();

  const lost = page.getByTestId('lost-day');
  await expect(lost.getByTestId('lost-line')).toHaveText('One thing before the day ends: Be intentional at Epic small group. Give the rest to Him.');
  await lost.getByRole('checkbox', { name: 'Be intentional at Epic small group' }).click();
  await lost.getByRole('button', { name: 'Glass of water Not yet' }).click();
  await lost.getByRole('button', { name: 'Cold shower Not yet' }).click();
  await lost.getByRole('button', { name: 'Walk with God Not yet' }).click();
  await expect(lost.getByTestId('lost-line')).toHaveText('Before bed, tell Him what you are surrendering.');
  await lost.getByLabel(/What are you giving to God tonight/).fill('The worry about school. It is Yours.');
  await lost.getByRole('button', { name: 'I give it to Him' }).click();
  await expect(lost.getByTestId('fire-meter')).toContainText('Purple fire');
  await expect(lost.getByTestId('lost-line')).toContainText('You are loved by God');

  // Faith events stay on a Lost Day.
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByTestId('block').filter({ hasText: 'Epic small group' })).toBeVisible();
  await page.getByRole('button', { name: 'Day options' }).click();
  await page.getByRole('menuitem', { name: 'End Lost Day' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End Lost Day' }).click();
  await expect(page.getByRole('checkbox', { name: 'Tax memo done', exact: true })).toBeVisible();
});

test('after 9 PM Home is the evening recap: the fire, the photo, the night check with the kaizen line', async ({ page }) => {
  await signedWithTasks(page, '2026-10-19T21:15', []);
  await checkIn(page, '7:30');
  const evening = page.getByTestId('evening');
  await expect(evening).toBeVisible();
  await expect(evening.getByRole('region', { name: "Today's photo" })).toBeVisible();
  await expect(evening.getByTestId('fire-meter')).toBeVisible();
  const check = evening.getByRole('region', { name: "Tonight's check" });
  await check.getByRole('radio', { name: 'Mind 3' }).click();
  await check.getByRole('radio', { name: 'Heart 4' }).click();
  await check.getByRole('radio', { name: 'Spirit 4' }).click();
  await check.getByLabel('Kaizen: one thing to do 1% better tomorrow').fill('In bed by 11');
  await check.getByRole('button', { name: "Save tonight's check" }).click();
  await expect(check.getByTestId('kaizen-saved')).toContainText('In bed by 11');
  await evening.getByRole('button', { name: 'Show the rest of Home' }).click();
  await expect(page.getByRole('region', { name: 'This week' })).toBeVisible();
});
