import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GU_NAMESPACES, gu } from '@/lib/i18n/messages/gu';
import { HI_NAMESPACES, hi } from '@/lib/i18n/messages/hi';

/**
 * Every string the factory dashboard shows through t() / tn() has a Hindi and a Gujarati
 * translation, and each language's files agree with each other. The staff console (/internal,
 * components/internal, components/admin) is English only and is not scanned.
 */
const LANGUAGES = [
  { name: 'Hindi', messages: hi, namespaces: HI_NAMESPACES },
  { name: 'Gujarati', messages: gu, namespaces: GU_NAMESPACES },
];

const SRC = join(__dirname, '..', '..');
const SKIP_DIRS = new Set(['__tests__', 'internal', 'admin', 'i18n', 'node_modules']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) sourceFiles(path, out);
    } else if (/\.(tsx?|mts)$/.test(name) && !/\.test\./.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const STRING = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"`;
// t('…') / t("…") — also `t: ` prefixes like `tr.t('…')`; not `it('…')`, `wait('…')`, `.at('…')`.
const T_CALL = new RegExp(String.raw`(?<![A-Za-z0-9_$.])t\(\s*(?:${STRING})`, 'g');
// tn(count, 'one', 'other')
const TN_CALL = new RegExp(String.raw`(?<![A-Za-z0-9_$.])tn\(\s*[^,]+,\s*(?:${STRING})\s*,\s*(?:${STRING})`, 'g');

function unescape(s: string): string {
  return s.replace(/\\(['"\\])/g, '$1');
}

/** Every t()/tn() key in a file. */
export function keysIn(source: string): string[] {
  const keys: string[] = [];
  for (const m of source.matchAll(T_CALL)) keys.push(unescape(m[1] ?? m[2] ?? ''));
  for (const m of source.matchAll(TN_CALL)) {
    keys.push(unescape(m[1] ?? m[2] ?? ''));
    keys.push(unescape(m[3] ?? m[4] ?? ''));
  }
  return keys.filter(Boolean);
}

const files = sourceFiles(SRC);
const usedKeys = new Map<string, string[]>();
for (const file of files) {
  const rel = relative(SRC, file);
  for (const key of keysIn(readFileSync(file, 'utf8'))) {
    const where = usedKeys.get(key) ?? [];
    where.push(rel);
    usedKeys.set(key, where);
  }
}

describe('the scan', () => {
  it('covers the dashboard code', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(usedKeys.size).toBeGreaterThan(0);
  });
});

describe.each(LANGUAGES)('$name', ({ messages, namespaces }) => {
  it('has a text for every key the dashboard shows (add it to lib/i18n/messages/<lang>/*.ts)', () => {
    const missing = [...usedKeys.entries()].filter(([key]) => !messages[key]);
    const report = missing
      .map(([key, where]) => `  ${JSON.stringify(key)}  ← ${[...new Set(where)].join(', ')}`)
      .join('\n');
    expect(missing.length, `\n${missing.length} untranslated:\n${report}\n`).toBe(0);
  });

  it('agrees with itself where two files translate the same English', () => {
    const seen = new Map<string, { ns: string; text: string }>();
    const conflicts: string[] = [];
    for (const [ns, table] of Object.entries(namespaces)) {
      for (const [key, text] of Object.entries(table)) {
        const prev = seen.get(key);
        if (prev && prev.text !== text) conflicts.push(`${JSON.stringify(key)}: ${prev.ns} vs ${ns}`);
        seen.set(key, { ns, text });
      }
    }
    expect(conflicts, conflicts.join('\n')).toEqual([]);
  });

  it('keeps the same placeholders as the English', () => {
    const holes = (s: string) => [...s.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort();
    const broken: string[] = [];
    for (const [key, text] of Object.entries(messages)) {
      if (holes(key).join() !== holes(text).join()) broken.push(`${JSON.stringify(key)} → ${JSON.stringify(text)}`);
    }
    expect(broken, broken.join('\n')).toEqual([]);
  });

  it('never leaves a translation empty', () => {
    const empty = Object.entries(messages).filter(([, text]) => !text.trim()).map(([k]) => k);
    expect(empty).toEqual([]);
  });
});

describe('Gujarati mirrors Hindi', () => {
  it('has exactly the keys Hindi has, so neither language falls behind the other', () => {
    const onlyHi = Object.keys(hi).filter((k) => !(k in gu));
    const onlyGu = Object.keys(gu).filter((k) => !(k in hi));
    expect(onlyHi, `only in Hindi:\n${onlyHi.join('\n')}`).toEqual([]);
    expect(onlyGu, `only in Gujarati:\n${onlyGu.join('\n')}`).toEqual([]);
  });
});
