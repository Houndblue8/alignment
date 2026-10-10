// Every screen works from 360 px wide: nothing overflows sideways.
import { expect, test } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

test.use({ viewport: { width: 360, height: 740 } });

test('no screen overflows sideways at 360 px', async ({ page }) => {
  test.setTimeout(90_000);
  await signedWithTasks(page, '2026-10-12T07:30', [
    { id: 't1', title: 'A very long task title that keeps going to test that cards truncate instead of overflowing', importance: 5 },
  ]);
  await checkIn(page, '7:30');
  for (const path of ['/', '/today', '/week', '/week/2026-10-12', '/quotes', '/settings', '/vision']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > vw + 1)
        .slice(0, 3)
        .map((e) => `${e.tagName}.${e.className}`);
    });
    expect(overflow, path).toEqual([]);
  }
});
