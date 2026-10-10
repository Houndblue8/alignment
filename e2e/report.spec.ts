// Sunday scouting report (Phase 5, Appendix E 3).
import { expect, test } from '@playwright/test';
import { checkIn, setNow, signedWithTasks } from './helpers';

test('the week closes Sunday night: Home offers the report, the coach writes it, Week keeps it', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __alignmentAI: unknown }).__alignmentAI = {
      coach: async () => 'Steady.',
      scout: async (req: { facts: { cold_shower: string } }) => ({
        held: `Cold shower held at ${req.facts.cold_shower}.`,
        slipped: 'The walk slipped on Saturday.',
        adjustment: 'Walk before the phone comes out.',
        vision: 'This is the man who keeps his word.',
      }),
    };
  });
  await signedWithTasks(page, '2026-10-17T08:00', []);
  await checkIn(page, '7:30');
  await setNow(page, '2026-10-18T09:00');
  await page.goto('/');
  await checkIn(page, '7:30');
  await expect(page.getByRole('link', { name: /Scouting report is in/ })).toHaveCount(0);

  await setNow(page, '2026-10-18T23:30');
  await page.goto('/');
  await page.getByRole('link', { name: /Scouting report is in/ }).click();
  await expect(page.getByRole('heading', { name: 'Scouting report' })).toBeVisible();
  await expect(page.getByText('Week of Oct 12 to Oct 18')).toBeVisible();
  await expect(page.getByRole('region', { name: 'What held' })).toContainText('Cold shower held at 0 of 2.');
  await expect(page.getByRole('region', { name: 'One adjustment' })).toContainText('Walk before the phone comes out.');

  // Monday: still offered on Home, and saved, so Week opens the same report.
  await setNow(page, '2026-10-19T08:00');
  await page.goto('/');
  await checkIn(page, '7:30');
  await expect(page.getByRole('link', { name: /Scouting report is in/ })).toBeVisible();
  await page.goto('/week');
  await page.getByRole('button', { name: 'Previous week' }).click();
  await page.getByRole('link', { name: 'Scouting report' }).click();
  await expect(page.getByRole('region', { name: 'Tied to your vision' })).toContainText('This is the man who keeps his word.');
});

test('without the coach the plain report from the facts stands in', async ({ page }) => {
  await signedWithTasks(page, '2026-10-18T09:00', []);
  await checkIn(page, '7:30');
  await setNow(page, '2026-10-18T23:30');
  await page.goto('/report');
  await expect(page.getByRole('region', { name: 'What held' })).toContainText('series lost');
  await expect(page.getByRole('region', { name: 'Where you slipped' })).toBeVisible();
  await expect(page.getByText('Plain version: the coach was not available.')).toBeVisible();
  // Earlier weeks are one tap back.
  await page.getByRole('link', { name: "Previous week's report" }).click();
  await expect(page.getByText('Week of Oct 5 to Oct 11')).toBeVisible();
});
