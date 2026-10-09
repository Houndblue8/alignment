// Part 14 tests 20 (signing moment) and 24 (themes), plus the six themes at phone width.
import { expect, test } from '@playwright/test';
import { checkIn, fresh, signedWithTasks } from './helpers';

test('20. signing writes the name by hand, draws the line, stamps the seal, then moves on', async ({ page }) => {
  await fresh(page, '2026-10-12T07:45');
  await expect(page.getByRole('heading', { name: 'I already decided.' })).toBeVisible();
  await expect(page.locator('.clause')).toHaveCount(5);
  await page.getByLabel('Type your full name to sign').fill('Eli Test');
  // The name fills the blank in the opening line as it is typed.
  await expect(page.locator('.blank.filled')).toHaveText('Eli Test');
  await page.getByRole('button', { name: 'Sign' }).click();
  const sig = page.locator('.sig-text');
  await expect(sig).toHaveText('Eli Test');
  expect(await sig.evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Great Vibes');
  expect(await sig.evaluate((e) => getComputedStyle(e).animationName)).toBe('write');
  await expect(page.locator('.seal-stamp')).toBeVisible();
  // Holds, then fades and slides up into the morning check-in.
  await expect(page.getByRole('heading', { name: 'What time did you wake up?' })).toBeVisible({ timeout: 8000 });
});

test('20b. tap skips ahead; reduced motion shows a plain fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, '2026-10-12T07:45');
  await page.getByLabel('Type your full name to sign').fill('Eli Test');
  await page.getByRole('button', { name: 'Sign' }).click();
  await expect(page.locator('.sig-text')).toBeVisible();
  expect(await page.locator('.sig-text').evaluate((e) => getComputedStyle(e).clipPath)).toBe('none');
  await page.locator('.contract-doc').click();
  await expect(page.getByRole('heading', { name: 'What time did you wake up?' })).toBeVisible({ timeout: 2000 });
});

test('24. a theme switch applies at once and persists after reload', async ({ page }) => {
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg()).toBe('rgb(251, 247, 238)');

  // From the palette button in the top bar.
  await page.getByRole('button', { name: 'Change theme' }).click();
  await page.getByRole('radio', { name: /Black Panther/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black-panther');
  await expect.poll(bg).toBe('rgb(9, 8, 13)');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'black-panther');
  expect(await bg()).toBe('rgb(9, 8, 13)');

  // And from Settings.
  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
  await page.getByText('Theme', { exact: true }).click();
  await page.getByRole('radio', { name: /Sakura/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura');
});

test('every theme renders every screen without overflow', async ({ page }) => {
  test.setTimeout(120_000); // 6 themes x 4 screens
  await signedWithTasks(page, '2026-10-16T08:30', [{ id: 't', title: 'Launch page', importance: 5 }]);
  await checkIn(page, '7:30');
  for (const theme of ['gold-cream', 'sakura', 'ocean', 'forest-ember', 'black-gold', 'black-panther']) {
    // The account setting decides the theme (the browser copy only prevents a flash).
    await page.evaluate((t) => {
      const db = JSON.parse(localStorage.getItem('alignment.localdb')!);
      db.settings.theme = t;
      localStorage.setItem('alignment.localdb', JSON.stringify(db));
    }, theme);
    for (const path of ['/', '/today', '/week', '/settings']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > vw + 1).length;
      });
      expect(overflow, `${theme} ${path}`).toBe(0);
    }
  }
});
