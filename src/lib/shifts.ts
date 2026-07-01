export type ShiftId = 'A' | 'B';

/** Return the most-recently-started window for the given shift (may still be in progress). */
export function shiftWindow(shiftId: ShiftId, refDate = new Date()): { from: Date; to: Date } {
  const d = new Date(refDate);
  const now = new Date();

  if (shiftId === 'A') {
    // Day shift 06:00–18:00
    const end = new Date(d);
    end.setHours(18, 0, 0, 0);
    // If current time is before 18:00 today, the shift is still in progress – use now as "to"
    // If before 06:00, step back to yesterday's shift
    if (d < end) {
      const dayStart = new Date(d);
      dayStart.setHours(6, 0, 0, 0);
      if (d < dayStart) {
        // Before today's day shift: use yesterday's completed shift
        end.setDate(end.getDate() - 1);
      } else {
        // In today's day shift: cap "to" at now
        end.setTime(now.getTime());
      }
    }
    const start = new Date(end);
    // If "to" was capped at now, compute start from today at 06:00
    if (end.getHours() !== 18 || end.getMinutes() !== 0) {
      start.setHours(6, 0, 0, 0);
    } else {
      start.setHours(6, 0, 0, 0);
    }
    return { from: start, to: end };
  }

  // Night shift B: 18:00 → 06:00 next day
  const h = d.getHours();
  let start: Date;
  let end: Date;

  if (h >= 18) {
    // Currently in night shift: started today at 18:00, ends tomorrow 06:00
    start = new Date(d);
    start.setHours(18, 0, 0, 0);
    end = new Date(now); // cap at now
  } else if (h < 6) {
    // Currently in night shift: started yesterday at 18:00, ends today 06:00
    start = new Date(d);
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
    end = new Date(now);
  } else {
    // Between 06:00 and 18:00 — last completed night shift
    end = new Date(d);
    end.setHours(6, 0, 0, 0);
    start = new Date(end);
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
  }

  return { from: start, to: end };
}

/**
 * Window for the shift that is currently in progress (06:00–18:00 → Day,
 * otherwise Night). Used as the default range so "no selection" shows the
 * current shift's data and picking the matching shift preset is a no-op.
 */
export function currentShiftWindow(refDate = new Date()): { from: Date; to: Date } {
  const h = refDate.getHours();
  const inDayShift = h >= 6 && h < 18;
  return shiftWindow(inDayShift ? 'A' : 'B', refDate);
}

/** Client-side shift defaults (mirrors backend). */
export const DEFAULT_SHIFTS = [
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
