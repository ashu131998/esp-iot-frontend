/**
 * Numbers and dates the way an Indian factory reads them, in English or Hindi.
 *
 * Numbers: Indian digit grouping (1,00,000 = one lakh, 1,00,00,000 = one crore) in both
 * languages, with Latin digits (what every shop floor and invoice uses). Compact figures say
 * lakh and crore: "1.2L" in English, "1.2 लाख" in Hindi.
 *
 * Dates and times: always the factory's clock, Indian Standard Time (APP_TZ), whatever time
 * zone the phone or laptop is set to, 12-hour clock. Hindi gets Hindi month and day names.
 *
 * Pure functions: safe on the server and in the browser; formatters are cached per language.
 */

import { localeTag, type Locale } from '@/lib/i18n/locale';
import { APP_TZ } from '@/lib/shifts';

const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = numberFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(localeTag(locale), options);
    numberFormatters.set(key, fmt);
  }
  return fmt;
}

function dateFormatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = dateFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(localeTag(locale), { timeZone: APP_TZ, ...options });
    dateFormatters.set(key, fmt);
  }
  return fmt;
}

/** A whole number with Indian grouping: 1234567 → "12,34,567". Rounds to the nearest whole. */
export function formatInt(value: number, locale: Locale = 'en'): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter(locale, { maximumFractionDigits: 0 }).format(value);
}

/** A number with exactly `digits` decimals and Indian grouping: (1234.5, 1) → "1,234.5". */
export function formatDecimal(value: number, digits: number, locale: Locale = 'en'): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Up to `maxDigits` decimals, no trailing zeros, Indian grouping: (1200, 2) → "1,200", (25.4, 2) → "25.4". */
export function formatUpTo(value: number, maxDigits: number, locale: Locale = 'en'): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter(locale, { maximumFractionDigits: maxDigits }).format(value);
}

/**
 * A short figure for chart axes and tiles: 1200 → "1.2K" / "1.2 हज़ार", 123456 → "1.2L" / "1.2 लाख",
 * 12345678 → "1.2Cr" / "1.2 क॰".
 */
export function formatCompact(value: number, locale: Locale = 'en'): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2 Nov, 01:35 pm" / "2 नव॰, 01:35 pm" — a moment, in factory time. */
export function formatDateTime(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** "01:35 pm" — a time of day, in factory time. */
export function formatTime(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** "01:35:07 pm" — a time of day with seconds, in factory time. */
export function formatTimeWithSeconds(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);
}

/** "2 Nov" / "2 नव॰" — a day, in factory time. */
export function formatDayMonth(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, { month: 'short', day: 'numeric' }).format(d);
}

/** "Mon, 2 Nov" / "सोम, 2 नव॰" — a day with its weekday, in factory time. */
export function formatWeekdayDayMonth(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
}

/** "2 Nov 2026" / "2 नव॰ 2026" — a full date, in factory time. */
export function formatFullDate(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

/** "Mon, 2 Nov 2026, 01:35:07 pm" — a full moment to the second, in factory time (timeline tooltips). */
export function formatFullDateTimeSeconds(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
}

/** "2 Nov 2026, 01:35 pm" — a full date and time, in factory time. */
export function formatFullDateTime(value: string | number | Date, locale: Locale = 'en'): string {
  const d = toDate(value);
  if (!d) return '—';
  return dateFormatter(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/**
 * A calendar day key ("2026-11-02") as a date at noon in factory time, so formatting it never
 * slips to the day before or after in another time zone.
 */
export function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00+05:30`);
}

/** Today's calendar day in factory time, as "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(now);
}
