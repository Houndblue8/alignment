// Part 1 rule 7: no em dashes and no emoji anywhere the app writes to Eli (code and seed data).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p);
    return /\.(tsx?|json)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}

test('no em dashes, en dashes or emoji in app text', () => {
  const bad: string[] = [];
  for (const f of [...files('src'), ...files('seed')]) {
    const text = readFileSync(f, 'utf8');
    if (/[–—]/.test(text) || /\p{Extended_Pictographic}/u.test(text)) bad.push(f);
  }
  expect(bad).toEqual([]);
});
