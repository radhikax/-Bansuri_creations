import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTRAST_PAIRS, PALETTE } from './palette';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('brand palette', () => {
  it.each(CONTRAST_PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    expect(ratio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(min);
  });

  it('theme.css defines exactly the palette tokens with the same values', () => {
    const css = readFileSync(resolve(__dirname, 'theme.css'), 'utf8');
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(css.toLowerCase()).toContain(`--${name}: ${hex.toLowerCase()};`);
    }
    expect(css).not.toMatch(/--accent-(gold|rose|sage)/);
    expect(css).not.toMatch(/\.dark\s*\{/);
  });
});
