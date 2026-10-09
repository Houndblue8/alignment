// Talk box UI: dump tests 17 to 19 through the real screens (fake AI) and test 25 (voice input).
import { expect, test, type Page } from '@playwright/test';
import { checkIn, signedWithTasks } from './helpers';

/** A fake AI on window.__alignmentAI. Replies depend on the words. */
async function installFakeAI(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __aiCalls: unknown[]; __alignmentAI: unknown };
    w.__aiCalls = [];
    const titles = ['Tax memo', 'Course module 3', 'Email the printer', 'Pay rent', 'Read chapter 9'];
    w.__alignmentAI = {
      parse: async (req: { text: string; context: { now: { date: string } } }) => {
        w.__aiCalls.push(req);
        if (req.text.startsWith('bad')) return { ops: [{ op: 'teleport', source_text: 'bad' }], unhandled: [], summary: '' };
        if (req.text.startsWith('brain dump')) {
          const [y, m, d] = req.context.now.date.split('-').map(Number);
          const due = (n: number) => new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
          return {
            ops: titles.map((title, i) => ({
              op: 'add_task',
              source_text: title,
              title,
              journey: i % 2 ? 'shs' : 'school',
              importance: 4,
              deadline: due(2 + i),
              minutes: 40,
              work_type: 'deep',
              steps: [{ text: 'Open it', guess: true }],
            })),
            unhandled: [{ text: 'and text my mom', reason: 'The app cannot send messages for you.' }],
            summary: 'Five tasks added.',
          };
        }
        return { ops: [{ op: 'replan', source_text: req.text }], unhandled: [], summary: 'Replanned.' };
      },
    };
  });
}

const localDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('alignment.localdb')!));

async function openTalk(page: Page) {
  await page.getByRole('button', { name: /Open the talk box/ }).click();
  await expect(page.getByTestId('talk-input')).toBeVisible();
}

test('17. a brain dump of 5 items creates 5 tasks and Today and Week update without a refresh', async ({ page }) => {
  await installFakeAI(page);
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  await openTalk(page);
  await page.getByTestId('talk-input').fill('brain dump: tax memo, course module, email printer, rent, chapter 9, and text my mom');
  await page.getByRole('button', { name: 'Send' }).click();
  const card = page.getByTestId('result-card');
  await expect(card.getByRole('list', { name: 'Done' }).getByRole('listitem')).toHaveCount(5);
  await expect(card.getByRole('list', { name: "Couldn't do" })).toContainText('The app cannot send messages for you.');
  await expect(page.getByTestId('talk-input')).toHaveValue('');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByTestId('timeline').getByText('Tax memo').first()).toBeVisible();
  const db = await localDb(page);
  expect(db.tasks).toHaveLength(5);
  const plannedTitles = new Set(db.blocks.filter((b: { taskId: string | null }) => b.taskId).map((b: { taskId: string }) => db.tasks.find((t: { id: string }) => t.id === b.taskId).title));
  expect(plannedTitles.size).toBe(5);
  await page.getByRole('link', { name: 'Week' }).click();
  await expect(page.getByTestId('week-days')).toBeVisible();
});

test('18. invalid AI output is retried once, then shows an error, keeps the words and changes nothing', async ({ page }) => {
  await installFakeAI(page);
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  const before = await localDb(page);
  await openTalk(page);
  await page.getByTestId('talk-input').fill('bad request that cannot be parsed');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('nothing was changed');
  await expect(page.getByTestId('talk-input')).toHaveValue('bad request that cannot be parsed');
  expect(await page.evaluate(() => (window as unknown as { __aiCalls: unknown[] }).__aiCalls.length)).toBe(2);
  expect(await localDb(page)).toEqual(before);
});

test('19. Undo restores the exact previous state', async ({ page }) => {
  await installFakeAI(page);
  await signedWithTasks(page, '2026-10-16T08:30', [{ id: 'keep', title: 'Existing task', importance: 3 }]);
  await checkIn(page, '7:30');
  const sortBlocks = (db: { blocks: { id: string }[] }) => ({ ...db, blocks: [...db.blocks].sort((a, b) => a.id.localeCompare(b.id)) });
  const before = sortBlocks(await localDb(page));
  await openTalk(page);
  await page.getByTestId('talk-input').fill('brain dump of five things');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('result-card')).toContainText('Added Tax memo');
  expect((await localDb(page)).tasks).toHaveLength(6);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('result-card')).toContainText('Undone');
  expect(sortBlocks(await localDb(page))).toEqual(before);
});

test('Ctrl or Cmd plus K opens the talk box from any screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcut is for laptops');
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  await page.getByRole('navigation').getByRole('link', { name: 'Week' }).click();
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('talk-input')).toBeFocused();
});

test('25. the mic produces one copy of the spoken text and never erases typed text', async ({ page }) => {
  await page.addInitScript(() => {
    // A fake recognizer that repeats interim results (like Android Chrome), then one final result.
    type Res = { isFinal: boolean; 0: { transcript: string } };
    let used = false;
    class FakeRecognition {
      lang = '';
      continuous = true;
      interimResults = false;
      onresult: ((e: { results: Res[] }) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      start() {
        (window as unknown as { __recStarts: number }).__recStarts = ((window as unknown as { __recStarts?: number }).__recStarts ?? 0) + 1;
        if (used) return; // a restarted session hears nothing new
        used = true;
        const steps = ['I', 'I woke', 'I woke', 'I woke up', 'I woke up at', 'I woke up at', 'I woke up at 7:30'];
        steps.forEach((t, i) => setTimeout(() => this.onresult?.({ results: [{ isFinal: false, 0: { transcript: t } }] }), 30 * (i + 1)));
        setTimeout(() => {
          this.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'I woke up at 7:30' } }] });
          if (!this.continuous) setTimeout(() => this.onend?.(), 10);
        }, 30 * (steps.length + 1));
      }
      stop() {
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await signedWithTasks(page, '2026-10-16T08:30', []);
  await checkIn(page, '7:30');
  await openTalk(page);
  const box = page.getByTestId('talk-input');
  await box.fill('Note:');
  await page.getByRole('button', { name: 'Start voice input' }).click();
  await expect(box).toHaveValue('Note: I woke up at 7:30');
  await page.waitForTimeout(400);
  await expect(box).toHaveValue('Note: I woke up at 7:30');
  await page.getByRole('button', { name: 'Stop voice input' }).click();
  await expect(page.getByRole('button', { name: 'Start voice input' })).toBeVisible();
  await expect(box).toHaveValue('Note: I woke up at 7:30');
  // Typing still works after voice.
  await box.press('End');
  await box.type(' and walked.');
  await expect(box).toHaveValue('Note: I woke up at 7:30 and walked.');
});
