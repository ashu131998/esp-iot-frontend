/**
 * Shift windows resolve in APP_TZ (Asia/Kolkata, UTC+05:30), independent of the
 * machine running the tests, so assertions use absolute UTC instants.
 */
import { describe, it, expect } from 'vitest';
import { currentShiftWindow, previousShiftWindow, DEFAULT_SHIFTS } from '@/lib/shifts';
import type { Shift } from '@/lib/types';

/** Instant for an IST wall-clock time on 2026-10-24 (dayOffset shifts the date). */
function ist(hour: number, minute = 0, dayOffset = 0): Date {
  return new Date(Date.UTC(2026, 9, 24 + dayOffset, hour, minute) - 330 * 60_000);
}

// ── DEFAULT_SHIFTS ────────────────────────────────────────────────────────────

describe('DEFAULT_SHIFTS', () => {
  it('exports Day 06–18 and Night 18–06', () => {
    expect(DEFAULT_SHIFTS.map((s) => [s.shift_id, s.start_hour, s.end_hour])).toEqual([
      ['A', 6, 18],
      ['B', 18, 6],
    ]);
  });
});

// ── currentShiftWindow ────────────────────────────────────────────────────────

describe('currentShiftWindow (default shifts)', () => {
  it('day shift at 10:00 IST → from 06:00 IST, to = ref', () => {
    const ref = ist(10);
    const win = currentShiftWindow(DEFAULT_SHIFTS, ref);
    expect(win.shift.shift_id).toBe('A');
    expect(win.from).toEqual(ist(6));
    expect(win.to).toEqual(ref);
  });

  it('night shift at 21:00 IST → from 18:00 IST same day', () => {
    const win = currentShiftWindow(DEFAULT_SHIFTS, ist(21));
    expect(win.shift.shift_id).toBe('B');
    expect(win.from).toEqual(ist(18));
  });

  it('night shift at 03:00 IST → from 18:00 IST previous day', () => {
    const win = currentShiftWindow(DEFAULT_SHIFTS, ist(3));
    expect(win.shift.shift_id).toBe('B');
    expect(win.from).toEqual(ist(18, 0, -1));
  });

  it('exactly at shift change belongs to the new shift', () => {
    const win = currentShiftWindow(DEFAULT_SHIFTS, ist(18));
    expect(win.shift.shift_id).toBe('B');
    expect(win.from).toEqual(ist(18));
  });

  it('falls back to defaults for an empty schedule', () => {
    expect(currentShiftWindow([], ist(10)).shift.shift_id).toBe('A');
  });
});

// ── previousShiftWindow ───────────────────────────────────────────────────────

describe('previousShiftWindow (default shifts)', () => {
  it('during day shift → last night 18:00 → 06:00 IST', () => {
    const win = previousShiftWindow(DEFAULT_SHIFTS, ist(10));
    expect(win.shift.shift_id).toBe('B');
    expect(win.from).toEqual(ist(18, 0, -1));
    expect(win.to).toEqual(ist(6));
  });

  it('during night shift (evening) → today 06:00 → 18:00 IST', () => {
    const win = previousShiftWindow(DEFAULT_SHIFTS, ist(23, 40));
    expect(win.shift.shift_id).toBe('A');
    expect(win.from).toEqual(ist(6));
    expect(win.to).toEqual(ist(18));
  });

  it('during night shift (after midnight) → previous day 06:00 → 18:00 IST', () => {
    const win = previousShiftWindow(DEFAULT_SHIFTS, ist(2));
    expect(win.shift.shift_id).toBe('A');
    expect(win.from).toEqual(ist(6, 0, -1));
    expect(win.to).toEqual(ist(18, 0, -1));
  });
});

// ── custom schedules ──────────────────────────────────────────────────────────

describe('custom shift schedules', () => {
  const three: Shift[] = [
    { shift_id: 'A', name: 'Morning', start_hour: 8, end_hour: 16, duration_hours: 8, label: '' },
    { shift_id: 'B', name: 'Evening', start_hour: 16, end_hour: 0, duration_hours: 8, label: '' },
    { shift_id: 'C', name: 'Night', start_hour: 0, end_hour: 8, duration_hours: 8, label: '' },
  ];

  it('three 8h shifts: 05:00 IST is Night (from 00:00), previous is Evening', () => {
    const cur = currentShiftWindow(three, ist(5));
    expect(cur.shift.shift_id).toBe('C');
    expect(cur.from).toEqual(ist(0));
    const prev = previousShiftWindow(three, ist(5));
    expect(prev.shift.shift_id).toBe('B');
    expect(prev.from).toEqual(ist(16, 0, -1));
    expect(prev.to).toEqual(ist(0));
  });

  it('a gap between shifts: previous shift ends at its own end, not the next start', () => {
    const gappy: Shift[] = [
      { shift_id: 'A', name: 'Day', start_hour: 8, end_hour: 16, duration_hours: 8, label: '' },
      { shift_id: 'B', name: 'Late', start_hour: 18, end_hour: 22, duration_hours: 4, label: '' },
    ];
    const prev = previousShiftWindow(gappy, ist(19));
    expect(prev.shift.shift_id).toBe('A');
    expect(prev.from).toEqual(ist(8));
    expect(prev.to).toEqual(ist(16));
  });
});
