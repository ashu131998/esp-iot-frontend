import 'server-only';

import { cookies, headers } from 'next/headers';

import { LOCALE_COOKIE, pickLocale, type Locale } from './locale';
import { englishTranslator, makeTranslator, type Messages, type Translator } from './translate';

/** The language for this request: the cookie, else the browser's preference, else English. */
export async function getLocale(): Promise<Locale> {
  const [jar, hdrs] = await Promise.all([cookies(), headers()]);
  return pickLocale(jar.get(LOCALE_COOKIE)?.value, hdrs.get('accept-language'));
}

/** A language's messages; null for English (the code is the English text). Loaded on the server only. */
export async function getMessages(locale: Locale): Promise<Messages | null> {
  if (locale === 'hi') return (await import('./messages/hi')).hi;
  if (locale === 'gu') return (await import('./messages/gu')).gu;
  return null;
}

/** A translator for server components: `const { t } = await getT();`. */
export async function getT(): Promise<Translator> {
  const locale = await getLocale();
  if (locale === 'en') return englishTranslator;
  return makeTranslator(await getMessages(locale), locale);
}
