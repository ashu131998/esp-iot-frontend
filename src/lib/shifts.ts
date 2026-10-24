import type { Shift } from '@/lib/types';

/**
 * Civil timezone the whole product runs in (mirrors backend `APP_TZ`). Shift
 * boundaries are wall-clock hours in this zone, so they resolve identically on
 * the server (UTC) and in any browser.
 */
export const APP_TZ = 'Asia/Kolkata';

/** Client-side shift defaults (mirrors backend). */
export const DEFAULT_SHIFTS: Shift[] = [
  {
    shift_id: 'A',
    name: 'Day Shift',
    start_hour: 6,
    end_hour: 18,
    duration_hours: 12,
    label: '06:00 – 18:00',
  },
  {
    shift_id: 'B',
    name: 'Night Shift',
    start_hour: 18,
    end_hour: 6,
    duration_hours: 12,
    label: '18:00 – 06:00',
  },
];

export interface ShiftWindow {
  shift: Shift;
  from: Date;
  to: Date;
}

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zoneParts(date: Date) {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Instant at which the APP_TZ wall clock reads `year-month-day hour:00`. */
function zonedWallToInstant(year: number, month: number, day: number, hour: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  const p = zoneParts(new Date(guess));
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
  return new Date(guess - offset);
}

/** Latest instant at or before `ref` whose APP_TZ wall clock reads `hour:00`. */
function lastWallHour(ref: Date, hour: number): Date {
  const p = zoneParts(ref);
  const today = zonedWallToInstant(p.year, p.month, p.day, hour);
  return today <= ref ? today : zonedWallToInstant(p.year, p.month, p.day - 1, hour);
}

function shiftEnd(shift: Shift, from: Date): Date {
  const hours = shift.duration_hours || ((shift.end_hour - shift.start_hour + 24) % 24 || 24);
  return new Date(from.getTime() + hours * 3_600_000);
}

/** The most recently started shift as of `ref`, from its start through `ref`. */
export function currentShiftWindow(
  shifts: Shift[] = DEFAULT_SHIFTS,
  ref: Date = new Date(),
): ShiftWindow {
  const list = shifts.length ? shifts : DEFAULT_SHIFTS;
  let best: ShiftWindow | null = null;
  for (const shift of list) {
    const from = lastWallHour(ref, shift.start_hour);
    if (!best || from > best.from) best = { shift, from, to: ref };
  }
  return best!;
}

/** The completed shift immediately before the current one. */
export function previousShiftWindow(
  shifts: Shift[] = DEFAULT_SHIFTS,
  ref: Date = new Date(),
): ShiftWindow {
  const current = currentShiftWindow(shifts, ref);
  const before = new Date(current.from.getTime() - 1);
  const { shift, from } = currentShiftWindow(shifts, before);
  const end = shiftEnd(shift, from);
  return { shift, from, to: end < current.from ? end : current.from };
}
