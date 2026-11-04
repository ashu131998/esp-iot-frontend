/**
 * The dashboard's languages. English is the source language: every string in the code is
 * written in English and translated at render time (see translate.ts). The choice lives in a
 * cookie so the server renders the right language from the first byte (no flash of English)
 * and it survives sign-out. Safe to import from client and server code.
 */

export type Locale = 'en' | 'hi' | 'gu';

export const LOCALES: readonly Locale[] = ['en', 'hi', 'gu'];
export const DEFAULT_LOCALE: Locale = 'en';

/** The cookie that holds the choice; a year long, renewed on every change. */
export const LOCALE_COOKIE = 'fb_lang';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** How each language names itself, for the language switch. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
};

/** Short form for a narrow switch (phone bottom sheet, sidebar footer). */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: 'EN',
  hi: 'हिं',
  gu: 'ગુ',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The BCP 47 tag numbers and dates are formatted with. All are Indian: digits are grouped
 * the Indian way (12,34,567) and the clock is 12-hour. Hindi and Gujarati get their own month
 * and day names.
 */
export function localeTag(locale: Locale): 'en-IN' | 'hi-IN' | 'gu-IN' {
  if (locale === 'hi') return 'hi-IN';
  if (locale === 'gu') return 'gu-IN';
  return 'en-IN';
}

/**
 * The language to show: the cookie when it holds a known language; else the browser's first
 * preferred language when it is one we have (a phone set to Hindi opens in Hindi on its first
 * visit); else English.
 */
export function pickLocale(
  cookieValue: string | null | undefined,
  acceptLanguage?: string | null,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  for (const lang of preferredLanguages(acceptLanguage)) {
    // Only the languages we have: "en-GB" picks English, but "mr" (Marathi) does not pick Hindi.
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

/** Primary language subtags of an Accept-Language header, in the browser's order of preference. */
export function preferredLanguages(acceptLanguage?: string | null): string[] {
  if (!acceptLanguage) return [];
  return acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((p) => p.tag && p.tag !== '*' && p.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => p.tag.split('-')[0]);
}

/** The language cookie's value out of a Cookie header or document.cookie; null when unset. */
export function localeFromCookieString(cookieString: string | null | undefined): Locale | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1]?.trim();
  return isLocale(value) ? value : null;
}

/** The Set-Cookie / document.cookie string that stores a choice for a year. */
export function localeCookieString(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Store the choice in the browser (a year); nothing on the server. */
export function rememberLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = localeCookieString(locale);
}
