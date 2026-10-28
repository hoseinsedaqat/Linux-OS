import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Responsive contract.
 *
 * jsdom cannot lay out CSS, so these tests assert the *rules* instead: every
 * surface added for the games, media apps, the editor and the shell overlays
 * must carry a small-screen breakpoint, and the document must declare a proper
 * viewport so that those breakpoints are actually reachable on phones.
 */

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

const SHEETS: Array<{ file: string; selectors: string[] }> = [
  { file: 'src/styles/games.css', selectors: ['.games__grid', '.mines__board', '.game__bar', '.ttt__board'] },
  { file: 'src/styles/media.css', selectors: ['.music__layout', '.weather__hero', '.photos__figure'] },
  { file: 'src/styles/code.css', selectors: ['.code__sidebar', '.code__highlight'] },
  { file: 'src/styles/shell.css', selectors: ['.palette', '.overview__grid', '.tour'] },
];

describe('responsive stylesheets', () => {
  for (const sheet of SHEETS) {
    it(`${sheet.file} defines small-screen breakpoints`, () => {
      const css = read(sheet.file);
      expect(css).toMatch(/@media \(max-width: (8[0-9]{2}|7[0-9]{2}|6[0-9]{2}|5[0-9]{2}|4[0-9]{2})px\)/);
      for (const selector of sheet.selectors) {
        expect(css.includes(selector)).toBe(true);
      }
    });
  }

  it('never locks an app to a desktop-only width', () => {
    for (const sheet of SHEETS) {
      const css = read(sheet.file);
      const fixedWidths = [...css.matchAll(/(?<!max-|min-)width:\s*(\d{3,})px/g)].map((match) => Number(match[1]));
      expect(fixedWidths.filter((value) => value > 640)).toEqual([]);
    }
  });

  it('declares a mobile viewport and keeps the PWA theme colours', () => {
    const html = read('index.html');
    expect(html).toMatch(/name="viewport"[^>]*width=device-width/);
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/name="theme-color"/);
    expect(html).toMatch(/rel="manifest"/);
  });

  it('uses fluid grids wherever cards are laid out', () => {
    const games = read('src/styles/games.css');
    expect(games).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/);
    const shell = read('src/styles/shell.css');
    expect(shell).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/);
  });

  it('respects reduced motion in every new sheet', () => {
    for (const file of ['src/styles/games.css', 'src/styles/media.css', 'src/styles/code.css', 'src/styles/shell.css']) {
      expect(read(file)).toMatch(/prefers-reduced-motion/);
    }
  });

  it('keeps the editor readable on narrow windows', () => {
    const css = read('src/styles/code.css');
    expect(css).toMatch(/@media \(max-width: 760px\)/);
    expect(css).toMatch(/\.code__sidebar\s*\{[^}]*position:\s*absolute/s);
  });

  it('hides non-essential status fields on phones', () => {
    const css = read('src/styles/code.css');
    expect(css).toMatch(/\.code__status > span:nth-child\(4\)/);
  });
});
