import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeCookieString,
  localeFromCookieString,
  localeTag,
  pickLocale,
  preferredLanguages,
} from '@/lib/i18n/locale';

describe('isLocale', () => {
  it('knows English, Hindi and Gujarati only', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('hi')).toBe(true);
    expect(isLocale('gu')).toBe(true);
    expect(isLocale('mr')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('localeTag', () => {
  it('formats every language the Indian way', () => {
    expect(localeTag('en')).toBe('en-IN');
    expect(localeTag('hi')).toBe('hi-IN');
    expect(localeTag('gu')).toBe('gu-IN');
  });
});

describe('preferredLanguages', () => {
  it('orders by weight and keeps the primary subtag', () => {
    expect(preferredLanguages('hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7')).toEqual(['hi', 'hi', 'en', 'en']);
    expect(preferredLanguages('en-GB;q=0.5, hi;q=0.9')).toEqual(['hi', 'en']);
  });
  it('ignores wildcards, zero weights and an empty header', () => {
    expect(preferredLanguages('*')).toEqual([]);
    expect(preferredLanguages('fr;q=0')).toEqual([]);
    expect(preferredLanguages(null)).toEqual([]);
  });
});

describe('pickLocale', () => {
  it('the cookie wins over the browser', () => {
    expect(pickLocale('en', 'hi-IN,hi;q=0.9')).toBe('en');
    expect(pickLocale('hi', 'en-US')).toBe('hi');
  });
  it('without a cookie, a Hindi or Gujarati browser opens in its language and others in English', () => {
    expect(pickLocale(undefined, 'hi-IN,hi;q=0.9,en;q=0.8')).toBe('hi');
    expect(pickLocale(undefined, 'gu-IN,gu;q=0.9,en;q=0.8')).toBe('gu');
    expect(pickLocale(null, 'en-IN,en;q=0.9')).toBe('en');
    expect(pickLocale(null, 'mr-IN,mr;q=0.9')).toBe(DEFAULT_LOCALE);
    expect(pickLocale(null, undefined)).toBe(DEFAULT_LOCALE);
  });
  it('an unknown cookie value is ignored', () => {
    expect(pickLocale('xx', 'hi')).toBe('hi');
  });
});

describe('cookie strings', () => {
  it('reads the language out of a cookie header', () => {
    expect(localeFromCookieString(`esp_csrf=abc; ${LOCALE_COOKIE}=hi; other=1`)).toBe('hi');
    expect(localeFromCookieString(`${LOCALE_COOKIE}=en`)).toBe('en');
    expect(localeFromCookieString(`${LOCALE_COOKIE}=xx`)).toBe(null);
    expect(localeFromCookieString('')).toBe(null);
  });
  it('writes a year-long, site-wide cookie', () => {
    const s = localeCookieString('hi');
    expect(s).toContain(`${LOCALE_COOKIE}=hi`);
    expect(s).toContain('Path=/');
    expect(s).toContain('Max-Age=31536000');
    expect(s).toContain('SameSite=Lax');
  });
});
