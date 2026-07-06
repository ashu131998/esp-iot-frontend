import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  productionDayStart,
  resolveDateRange,
  presetRange,
  formatRangeLabel,
  rangeDurationLabel,
  isLiveRange,
  fromDateInputValue,
  toDateInputValue,
  PRODUCTION_DAY_START_HOUR,
} from '@/lib/date-range';

function atHour(h: number, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(h, 0, 0, 0);
  return d;
}

// ── productionDayStart ────────────────────────────────────────────────────────

describe('productionDayStart', () => {
  it('returns 06:00 same day when ref is after 06:00', () => {
    const ref = atHour(14);
    const start = productionDayStart(ref);
    expect(start.getHours()).toBe(PRODUCTION_DAY_START_HOUR);
    expect(start.getDate()).toBe(ref.getDate());
  });

  it('returns 06:00 previous day when ref is before 06:00', () => {
    const ref = atHour(3);
    const start = productionDayStart(ref);
    const yesterday = new Date(ref);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(start.getDate()).toBe(yesterday.getDate());
    expect(start.getHours()).toBe(PRODUCTION_DAY_START_HOUR);
  });

  it('returns 06:00 same day when ref is exactly 06:00', () => {
    const ref = atHour(6);
    const start = productionDayStart(ref);
    expect(start.getDate()).toBe(ref.getDate());
    expect(start.getHours()).toBe(6);
  });
});

// ── resolveDateRange — explicit params ────────────────────────────────────────

describe('resolveDateRange with explicit from/to', () => {
  it('preserves explicit ISO datetime params', () => {
    const from = '2025-03-10T06:00:00.000Z';
    const to = '2025-03-10T18:00:00.000Z';
    const result = resolveDateRange({ from, to });
    expect(result.from).toBe(from);
    expect(result.to).toBe(to);
  });

  it('snaps date-only from to start-of-day', () => {
    const result = resolveDateRange({ from: '2025-03-10', to: '2025-03-10T18:00:00.000Z' });
    // start-of-day means time is 00:00
    expect(parseISO(result.from).getHours()).toBe(0);
    expect(parseISO(result.from).getMinutes()).toBe(0);
  });

  it('snaps date-only to to end-of-day (23:59:59)', () => {
    const result = resolveDateRange({ from: '2025-03-10T06:00:00.000Z', to: '2025-03-10' });
    const end = parseISO(result.to);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('clamps start to minDate when before it', () => {
    const from = '2025-01-01T06:00:00.000Z';
    const to = '2025-03-10T18:00:00.000Z';
    const minDate = '2025-02-01T00:00:00.000Z';
    const result = resolveDateRange({ from, to }, minDate);
    expect(parseISO(result.from).getTime()).toBeGreaterThanOrEqual(
      parseISO(minDate).getTime(),
    );
  });
});

// ── resolveDateRange — no params ──────────────────────────────────────────────

describe('resolveDateRange with no params', () => {
  it('returns from < to', () => {
    const result = resolveDateRange({});
    expect(parseISO(result.from).getTime()).toBeLessThan(parseISO(result.to).getTime());
  });

  it('to is within a few seconds of now', () => {
    const now = Date.now();
    const result = resolveDateRange({});
    expect(Math.abs(parseISO(result.to).getTime() - now)).toBeLessThan(5000);
  });
});

// ── presetRange ───────────────────────────────────────────────────────────────

describe('presetRange', () => {
  it('"today" → from is production day start', () => {
    const { from } = presetRange('today');
    expect(parseISO(from).getHours()).toBe(PRODUCTION_DAY_START_HOUR);
  });

  it('"7d" → from is ~7 days ago at start-of-day', () => {
    const { from } = presetRange('7d');
    const diffMs = Date.now() - parseISO(from).getTime();
    const diffDays = diffMs / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThan(8);
  });

  it('"30d" → from is ~30 days ago', () => {
    const { from } = presetRange('30d');
    const diffDays = (Date.now() - parseISO(from).getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThan(31);
  });

  it('"all" without minDate falls back to ~6 months', () => {
    const { from } = presetRange('all');
    const diffDays = (Date.now() - parseISO(from).getTime()) / 86400000;
    expect(diffDays).toBeGreaterThan(150);
  });

  it('"all" with minDate uses minDate as floor', () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 10);
    const { from } = presetRange('all', minDate);
    const diffDays = (Date.now() - parseISO(from).getTime()) / 86400000;
    expect(diffDays).toBeLessThan(12);
  });

  it('to is within seconds of now', () => {
    const { to } = presetRange('30d');
    expect(Math.abs(Date.now() - parseISO(to).getTime())).toBeLessThan(5000);
  });
});

// ── formatRangeLabel ──────────────────────────────────────────────────────────

describe('formatRangeLabel', () => {
  it('same day → "MMM d, yyyy"', () => {
    const label = formatRangeLabel('2025-03-10T06:00:00.000Z', '2025-03-10T18:00:00.000Z');
    expect(label).toMatch(/Mar 10, 2025/);
  });

  it('same year different day → "MMM d – MMM d, yyyy"', () => {
    const label = formatRangeLabel('2025-03-01T00:00:00.000Z', '2025-03-10T00:00:00.000Z');
    expect(label).toContain('2025');
    expect(label).toContain('–');
  });

  it('cross-year → both years appear', () => {
    const label = formatRangeLabel('2024-12-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
    expect(label).toContain('2024');
    expect(label).toContain('2025');
  });
});

// ── rangeDurationLabel ────────────────────────────────────────────────────────

describe('rangeDurationLabel', () => {
  it('< 48h → "Xh window"', () => {
    const from = new Date(Date.now() - 12 * 3600000).toISOString();
    const to = new Date().toISOString();
    expect(rangeDurationLabel(from, to)).toMatch(/12h window/);
  });

  it('2–59 days → "X day window"', () => {
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const to = new Date().toISOString();
    expect(rangeDurationLabel(from, to)).toMatch(/7 day window/);
  });

  it('≥ 60 days → "X month window"', () => {
    const from = new Date(Date.now() - 90 * 86400000).toISOString();
    const to = new Date().toISOString();
    expect(rangeDurationLabel(from, to)).toMatch(/month window/);
  });
});

// ── isLiveRange ───────────────────────────────────────────────────────────────

describe('isLiveRange', () => {
  it('returns true for to=now', () => {
    expect(isLiveRange(new Date().toISOString())).toBe(true);
  });

  it('returns true for to within 60s of now', () => {
    const almostNow = new Date(Date.now() - 30000).toISOString();
    expect(isLiveRange(almostNow)).toBe(true);
  });

  it('returns false for to > 60s ago', () => {
    const old = new Date(Date.now() - 120000).toISOString();
    expect(isLiveRange(old)).toBe(false);
  });
});

// ── date input helpers ────────────────────────────────────────────────────────

describe('fromDateInputValue / toDateInputValue', () => {
  it('fromDateInputValue without end=true → start of day (00:00)', () => {
    const iso = fromDateInputValue('2025-03-10');
    expect(parseISO(iso).getHours()).toBe(0);
    expect(parseISO(iso).getMinutes()).toBe(0);
  });

  it('fromDateInputValue with end=true → end of day (23:59)', () => {
    const iso = fromDateInputValue('2025-03-10', true);
    expect(parseISO(iso).getHours()).toBe(23);
    expect(parseISO(iso).getMinutes()).toBe(59);
  });

  it('toDateInputValue formats ISO to yyyy-MM-dd', () => {
    const result = toDateInputValue('2025-03-10T12:30:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
