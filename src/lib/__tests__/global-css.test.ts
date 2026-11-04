import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * globals.css: a rule for every element written outside a cascade layer beats every Tailwind class
 * (Tailwind's utilities are layered), whatever its specificity. The default border colour once sat
 * there and turned every coloured border in the app grey: status stripes, warnings, selected
 * filters, the spinner's gap. Such rules belong in `@layer base`.
 */
const css = readFileSync(join(__dirname, '..', '..', 'app', 'globals.css'), 'utf8');

/** The selectors of the rules outside any block (@layer, @theme, @media …), comments left out. */
function unlayeredSelectors(text: string): string[] {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      if (depth === 0) {
        const prelude = source.slice(start, i).trim();
        if (!prelude.startsWith('@')) selectors.push(prelude);
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) start = i + 1;
    } else if (ch === ';' && depth === 0) {
      start = i + 1;   // @import "tailwindcss";
    }
  }
  return selectors;
}

const hitsEveryElement = (selector: string) =>
  selector.split(',').some((part) => /(^|[\s>+~])\*($|[\s:>+~,[])/.test(part.trim()));

describe('globals.css', () => {
  it('reads its rules (the scan sees the top-level ones)', () => {
    expect(unlayeredSelectors(css)).toEqual(expect.arrayContaining(['body', '.sidebar-surface']));
  });

  it('no rule for every element outside a layer', () => {
    expect(unlayeredSelectors(css).filter(hitsEveryElement)).toEqual([]);
  });

  it('the default border colour is in the base layer, so border colour classes win', () => {
    expect(css).toMatch(/@layer base\s*\{[^}]*\*\s*\{\s*border-color:\s*var\(--border\)/);
  });

  it('the check itself catches the old rule', () => {
    expect(unlayeredSelectors('* { border-color: var(--border); }').filter(hitsEveryElement)).toEqual(['*']);
    expect(unlayeredSelectors('.panel * { border-color: red; }').filter(hitsEveryElement)).toEqual(['.panel *']);
    expect(unlayeredSelectors('@layer base { * { border-color: red; } }').filter(hitsEveryElement)).toEqual([]);
  });
});
