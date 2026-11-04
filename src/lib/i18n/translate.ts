/**
 * Translation of UI strings. The English text in the code is the key: `t('Running')` looks
 * up 'Running' in the active language's messages and falls back to the English itself, so a
 * string without a translation still shows (in English) rather than as a key or nothing.
 *
 * Placeholders are `{name}`: t('{count} machines stopped', { count: 3 }). Numbers given as
 * variables are written the Indian way (12,34,567) in both languages; pass a string to keep a
 * number exactly as it is (an ID, a year).
 *
 * Plurals: tn(n, '{count} machine', '{count} machines') picks the English form by n and
 * translates it; Hindi, like English, has one form for 1 and one for the rest.
 *
 * Pure functions: the React hook (context.tsx) and the server helper (server.ts) call these.
 */

import type { Locale } from './locale';
import { formatInt } from '@/lib/format';

export type Messages = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number | null | undefined>>;

export type Translate = (key: string, vars?: Vars) => string;
export type TranslatePlural = (count: number, one: string, other: string, vars?: Vars) => string;

export interface Translator {
  t: Translate;
  tn: TranslatePlural;
  locale: Locale;
}

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** `template` with every `{name}` replaced by vars.name; unknown names stay as written. */
export function interpolate(template: string, vars?: Vars, locale: Locale = 'en'): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    if (!(name in vars)) return whole;
    const value = vars[name];
    if (value === null || value === undefined) return '';
    return typeof value === 'number' ? formatInt(value, locale) : String(value);
  });
}

/** The translation of `key` (the English text), or the English itself; then its placeholders filled. */
export function translate(
  messages: Messages | null | undefined,
  locale: Locale,
  key: string,
  vars?: Vars,
): string {
  const text = (messages && messages[key]) || key;
  return interpolate(text, vars, locale);
}

/** Singular for 1, plural otherwise, translated; `count` is available as {count}. */
export function translatePlural(
  messages: Messages | null | undefined,
  locale: Locale,
  count: number,
  one: string,
  other: string,
  vars?: Vars,
): string {
  const key = count === 1 ? one : other;
  return translate(messages, locale, key, { count, ...vars });
}

/** A translator bound to one language's messages (null for English: nothing to look up). */
export function makeTranslator(messages: Messages | null | undefined, locale: Locale): Translator {
  return {
    t: (key, vars) => translate(messages, locale, key, vars),
    tn: (count, one, other, vars) => translatePlural(messages, locale, count, one, other, vars),
    locale,
  };
}

/** The English translator: every key is its own text. */
export const englishTranslator: Translator = makeTranslator(null, 'en');
