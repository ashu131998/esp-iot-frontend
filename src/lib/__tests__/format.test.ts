import { describe, expect, it } from 'vitest';

import {
  dayKeyToDate,
  formatCompact,
  formatDateTime,
  formatDayMonth,
  formatDecimal,
  formatFullDate,
  formatInt,
  formatTime,
  formatUpTo,
  formatWeekdayDayMonth,
  todayKey,
} from '@/lib/format';

// 2026-11-02 08:05 UTC = 13:35 IST (a Monday).
const AT = '2026-11-02T08:05:00Z';

describe('Indian number grouping', () => {
  it('groups whole numbers in lakhs and crores', () => {
    expect(formatInt(999)).toBe('999');
    expect(formatInt(1000)).toBe('1,000');
    expect(formatInt(12345)).toBe('12,345');
    expect(formatInt(100000)).toBe('1,00,000');
    expect(formatInt(1234567)).toBe('12,34,567');
    expect(formatInt(10000000)).toBe('1,00,00,000');
  });
  it('rounds to whole numbers and keeps the sign', () => {
    expect(formatInt(1234.6)).toBe('1,235');
    expect(formatInt(-100000)).toBe('-1,00,000');
  });
  it('is the same grouping in Hindi, with Latin digits', () => {
    expect(formatInt(1234567, 'hi')).toBe('12,34,567');
  });
  it('shows a dash for figures that are not numbers', () => {
    expect(formatInt(Number.NaN)).toBe('—');
    expect(formatDecimal(Number.POSITIVE_INFINITY, 1)).toBe('—');
  });
});

describe('formatDecimal / formatUpTo', () => {
  it('fixes the decimals', () => {
    expect(formatDecimal(42, 1)).toBe('42.0');
    expect(formatDecimal(3.14159, 3)).toBe('3.142');
    expect(formatDecimal(123456.78, 1)).toBe('1,23,456.8');
  });
  it('drops trailing zeros up to a limit', () => {
    expect(formatUpTo(1200, 2)).toBe('1,200');
    expect(formatUpTo(25.4, 2)).toBe('25.4');
    expect(formatUpTo(3.333, 2)).toBe('3.33');
  });
});

describe('formatCompact', () => {
  it('says lakh and crore', () => {
    expect(formatCompact(1200)).toBe('1.2K');
    expect(formatCompact(123456)).toBe('1.2L');
    expect(formatCompact(12345678)).toBe('1.2Cr');
  });
  it('in Hindi and Gujarati words', () => {
    // ICU separates the number and the word with a non-breaking space.
    expect(formatCompact(123456, 'hi').replace(/\s/g, ' ')).toBe('1.2 लाख');
    expect(formatCompact(123456, 'gu').replace(/\s/g, ' ')).toBe('1.2 લાખ');
    expect(formatInt(1234567, 'gu')).toBe('12,34,567');
  });
  it('small numbers stay as they are', () => {
    expect(formatCompact(42)).toBe('42');
  });
});

describe('dates in factory time (IST)', () => {
  it('formats a moment with the day, month and 12-hour clock', () => {
    expect(formatDateTime(AT)).toBe('2 Nov, 01:35 pm');
    expect(formatTime(AT)).toBe('01:35 pm');
    expect(formatDayMonth(AT)).toBe('2 Nov');
    expect(formatWeekdayDayMonth(AT)).toBe('Mon, 2 Nov');
    expect(formatFullDate(AT)).toBe('2 Nov 2026');
  });
  it('uses Hindi month and day names in Hindi, Gujarati ones in Gujarati', () => {
    expect(formatDateTime(AT, 'hi')).toBe('2 नव॰, 01:35 pm');
    expect(formatWeekdayDayMonth(AT, 'hi')).toBe('सोम, 2 नव॰');
    expect(formatWeekdayDayMonth(AT, 'gu')).toBe('સોમ, 2 નવે');
  });
  it('a day just after midnight IST is still that day', () => {
    // 2026-11-02 19:00 UTC = 00:30 IST on 3 Nov.
    expect(formatDayMonth('2026-11-02T19:00:00Z')).toBe('3 Nov');
  });
  it('accepts Date objects and shows a dash for junk', () => {
    expect(formatTime(new Date(AT))).toBe('01:35 pm');
    expect(formatDateTime('not a date')).toBe('—');
  });
});

describe('day keys', () => {
  it('a day key formats as that day in every time zone', () => {
    expect(formatDayMonth(dayKeyToDate('2026-11-02'))).toBe('2 Nov');
    expect(formatWeekdayDayMonth(dayKeyToDate('2026-11-02'))).toBe('Mon, 2 Nov');
  });
  it("today's key follows the factory clock", () => {
    expect(todayKey(new Date('2026-11-02T19:00:00Z'))).toBe('2026-11-03');
    expect(todayKey(new Date('2026-11-02T08:05:00Z'))).toBe('2026-11-02');
  });
});
