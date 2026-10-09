import { expect, type Page } from '@playwright/test';

/** Freeze the app clock (America/Los_Angeles local time), e.g. '2026-10-12T07:45'. */
export async function setNow(page: Page, iso: string) {
  await page.evaluate((v) => localStorage.setItem('alignment.fakeNow', v), iso);
}

/** Fresh app at a frozen time. */
export async function fresh(page: Page, iso: string) {
  await page.goto('/');
  await page.evaluate((v) => {
    localStorage.clear();
    localStorage.setItem('alignment.fakeNow', v);
  }, iso);
  await page.reload();
}

export interface SeedTask {
  id: string;
  title: string;
  importance: number;
  estimatedMinutes?: number;
}

/** Fresh app with the contract signed and some tasks, ready for the morning check-in. */
export async function signedWithTasks(page: Page, iso: string, tasks: SeedTask[]) {
  await fresh(page, iso);
  await expect(page.getByRole('button', { name: 'Sign' })).toBeVisible();
  await page.evaluate((list) => {
    const db = JSON.parse(localStorage.getItem('alignment.localdb')!);
    db.contract.signedName = 'Test Signer';
    db.contract.signedAt = '2026-10-01T12:00:00.000Z';
    db.tasks = list.map((t) => ({
      journey: 'shs',
      deadline: null,
      estimatedMinutes: 60,
      deferralCount: 0,
      workType: 'deep',
      createdAt: '2026-10-01T12:00:00.000Z',
      status: 'open',
      notes: '',
      steps: [],
      completedAt: null,
      ...t,
    }));
    localStorage.setItem('alignment.localdb', JSON.stringify(db));
  }, tasks);
  await page.reload();
}

/** Complete the morning check-in with a wake time chip. */
export async function checkIn(page: Page, chip = '7:30') {
  await expect(page.getByRole('heading', { name: 'What time did you wake up?' })).toBeVisible();
  await page.getByRole('button', { name: chip, exact: true }).click();
  await page.getByRole('button', { name: 'Build my day' }).click();
  await expect(page.getByRole('button', { name: /^Next:/ })).toBeVisible();
}
