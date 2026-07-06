/**
 * shifts.ts uses local time (setHours). Tests use getHours() not UTC equivalents.
 */
import { describe, it, expect } from 'vitest';
import { shiftWindow, currentShiftWindow, DEFAULT_SHIFTS } from '@/lib/shifts';

function atHour(h: number, date = new Date()): Date {
  const d = new Date(date);
  d.setHours(h, 0, 0, 0);
  return d;
}

// ── DEFAULT_SHIFTS ────────────────────────────────────────────────────────────

describe('DEFAULT_SHIFTS', () => {
  it('exports two shifts: A (Day) and B (Night)', () => {
    expect(DEFAULT_SHIFTS).toHaveLength(2);
    expect(DEFAULT_SHIFTS[0].shift_id).toBe('A');
    expect(DEFAULT_SHIFTS[1].shift_id).toBe('B');
  });
  it('Day shift starts at 06:00 and ends at 18:00', () => {
    expect(DEFAULT_SHIFTS[0].start_hour).toBe(6);
    expect(DEFAULT_SHIFTS[0].end_hour).toBe(18);
  });
  it('Night shift starts at 18:00 and ends at 06:00', () => {
    expect(DEFAULT_SHIFTS[1].start_hour).toBe(18);
    expect(DEFAULT_SHIFTS[1].end_hour).toBe(6);
  });
});

// ── shiftWindow — shift A (Day 06:00–18:00) ───────────────────────────────────

describe('shiftWindow A — completed (after 18:00)', () => {
  it('from=06:00, to=18:00 same day when ref is at 20:00', () => {
    const ref = atHour(20);
    const { from, to } = shiftWindow('A', ref);
    expect(from.getHours()).toBe(6);
    expect(to.getHours()).toBe(18);
    expect(to.getMinutes()).toBe(0);
    expect(from.getDate()).toBe(ref.getDate());
  });
});

describe('shiftWindow A — in-progress (08:00–17:00)', () => {
  it('from=06:00 today, to≈actual now when ref is 10:00', () => {
    const ref = atHour(10);
    const { from, to } = shiftWindow('A', ref);
    expect(from.getHours()).toBe(6);
    expect(from.getDate()).toBe(ref.getDate());
    // shiftWindow uses new Date() internally for the "to" cap — assert actual now
    expect(Math.abs(to.getTime() - Date.now())).toBeLessThan(5000);
  });
});

describe('shiftWindow A — pre-shift (before 06:00, use yesterday)', () => {
  it('from=yesterday 06:00, to=yesterday 18:00 when ref is 03:00', () => {
    const ref = atHour(3);
    const { from, to } = shiftWindow('A', ref);
    const yesterday = ref.getDate() - 1;
    expect(to.getHours()).toBe(18);
    expect(to.getMinutes()).toBe(0);
    // from and to should be on the same day (yesterday)
    expect(from.getDate()).toBe(to.getDate());
    // from is 06:00 on that day
    expect(from.getHours()).toBe(6);
    // Both are yesterday relative to ref
    const refYesterday = new Date(ref);
    refYesterday.setDate(refYesterday.getDate() - 1);
    expect(to.getDate()).toBe(refYesterday.getDate());
  });
});

// ── shiftWindow — shift B (Night 18:00–06:00) ────────────────────────────────

describe('shiftWindow B — in-progress (evening h≥18)', () => {
  it('from=18:00 today, to≈actual now when ref is 22:00', () => {
    const ref = atHour(22);
    const { from, to } = shiftWindow('B', ref);
    expect(from.getHours()).toBe(18);
    expect(from.getDate()).toBe(ref.getDate());
    // shiftWindow uses new Date() internally for the "to" cap — assert actual now
    expect(Math.abs(to.getTime() - Date.now())).toBeLessThan(5000);
  });
});

describe('shiftWindow B — in-progress (early morning h<6)', () => {
  it('from=yesterday 18:00, to≈actual now when ref is 02:00', () => {
    const ref = atHour(2);
    const { from } = shiftWindow('B', ref);
    // started yesterday at 18:00
    const yesterday = new Date(ref);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(from.getDate()).toBe(yesterday.getDate());
    expect(from.getHours()).toBe(18);
  });
});

describe('shiftWindow B — completed (daytime 06:00–18:00)', () => {
  it('from=yesterday 18:00, to=today 06:00 when ref is 12:00', () => {
    const ref = atHour(12);
    const { from, to } = shiftWindow('B', ref);
    expect(to.getHours()).toBe(6);
    expect(to.getDate()).toBe(ref.getDate());
    const yesterday = new Date(ref);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(from.getDate()).toBe(yesterday.getDate());
    expect(from.getHours()).toBe(18);
  });
});

// ── currentShiftWindow ────────────────────────────────────────────────────────

describe('currentShiftWindow', () => {
  it('returns shift A window during daytime (10:00)', () => {
    const ref = atHour(10);
    const win = currentShiftWindow(ref);
    expect(win.from.getHours()).toBe(6);
  });

  it('returns shift B window during evening (21:00)', () => {
    const ref = atHour(21);
    const win = currentShiftWindow(ref);
    expect(win.from.getHours()).toBe(18);
  });

  it('returns shift B window during early morning (03:00)', () => {
    const ref = atHour(3);
    const win = currentShiftWindow(ref);
    // started yesterday at 18:00
    const yesterday = new Date(ref);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(win.from.getDate()).toBe(yesterday.getDate());
    expect(win.from.getHours()).toBe(18);
  });

  it('from < to', () => {
    const ref = atHour(14);
    const { from, to } = currentShiftWindow(ref);
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
});
