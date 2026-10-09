// Every theme keeps text readable (WCAG AA: 4.5 for text, 3 for large text and icons).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { THEMES } from './themes';

const css = readFileSync('src/theme/tokens.css', 'utf8');

function vars(theme: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe.each(THEMES.map((t) => t.id))('theme %s', (id) => {
  const v = vars(id);
  const pairs: [string, string, number][] = [
    ['text', 'bg', 7],
    ['text', 'card', 7],
    ['muted', 'bg', 4.5],
    ['muted', 'card', 4.5],
    ['accent-ink', 'bg', 4.5],
    ['accent-ink', 'card', 4.5],
    ['on-accent', 'accent', 4.5],
    ['on-win', 'win', 4.5],
    ['on-half', 'half', 4.5],
    ['on-loss', 'loss', 4.5],
    ['text', 'accent-soft', 4.5],
    ['danger', 'card', 4.5],
    ['accent', 'card', 3],
  ];
  test.each(pairs)('%s on %s is at least %s', (fg, bg, min) => {
    expect(v[fg], `--${fg}`).toBeDefined();
    expect(v[bg], `--${bg}`).toBeDefined();
    expect(contrast(v[fg]!, v[bg]!)).toBeGreaterThanOrEqual(min);
  });
  test('journey colors are visible as dots on cards', () => {
    for (const j of ['body', 'sport', 'shs', 'school', 'faith', 'life']) expect(contrast(v[`j-${j}`]!, v.card!), j).toBeGreaterThanOrEqual(2.2);
  });
});
