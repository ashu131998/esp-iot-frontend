import { endOfDay, format, startOfDay, subDays, subHours, subMonths } from 'date-fns';

import { currentShiftWindow, previousShiftWindow } from '@/lib/shifts';
import type { Shift } from '@/lib/types';

/**
 * The date picker's ready-made periods, and what a choice sends: one rule for the
 * panel on a computer (pick, then Apply) and on a phone (one tap, no calendar).
 */

export const CURRENT_SHIFT = 'current-shift';
export const LAST_SHIFT = 'last-shift';

export interface Preset {
  id: string;
  label: string;
  hint?: string;
  getDates: () => { from: Date; to: Date };
}

/** "Night Shift" → "Night"; custom names without the suffix pass through. */
function shortShiftName(shift: Shift): string {
  return shift.name.replace(/\s*shift$/i, '') || shift.name;
}

export function buildPresets(shifts: Shift[] | undefined, clock: () => Date = () => new Date()): Preset[] {
  const now = clock();
  const cur = currentShiftWindow(shifts, now);
  const prev = previousShiftWindow(shifts, now);
  const back = (from: (n: Date) => Date) => () => {
    const n = clock();
    return { from: from(n), to: n };
  };
  return [
    {
      id: CURRENT_SHIFT,
      label: 'Current Shift',
      hint: `${shortShiftName(cur.shift)} · since ${format(cur.from, 'HH:mm')}`,
      getDates: () => ({ from: cur.from, to: clock() }),
    },
    {
      id: LAST_SHIFT,
      label: 'Last Shift',
      hint: `${shortShiftName(prev.shift)} · ${format(prev.from, 'HH:mm')}–${format(prev.to, 'HH:mm')}`,
      getDates: () => ({ from: prev.from, to: prev.to }),
    },
    { id: '24h', label: 'Last 24 Hours', getDates: back((n) => subHours(n, 24)) },
    { id: 'today', label: 'Today', getDates: back((n) => startOfDay(n)) },
    { id: '3d', label: 'Last 3 Days', getDates: back((n) => startOfDay(subDays(n, 3))) },
    { id: '7d', label: 'Last 7 Days', getDates: back((n) => startOfDay(subDays(n, 7))) },
    { id: '10d', label: 'Last 10 Days', getDates: back((n) => startOfDay(subDays(n, 10))) },
    { id: '1m', label: 'Last Month', getDates: back((n) => startOfDay(subMonths(n, 1))) },
    { id: '3m', label: 'Last 3 Months', getDates: back((n) => startOfDay(subMonths(n, 3))) },
  ];
}

/** The phone's panel has no calendar: these periods only. */
const NOT_ON_PHONES = new Set(['10d']);

export function phonePresets(presets: Preset[]): Preset[] {
  return presets.filter((p) => !NOT_ON_PHONES.has(p.id));
}

/** Older than 3 days only daily aggregates are stored: such a range is whole days. */
export function aggregatesOnly(from: Date, now: Date = new Date()): boolean {
  return from < startOfDay(subDays(now, 3));
}

/** 'live': no dates (the current shift, rolling over at shift change); null: nothing to send. */
export type Selection = 'live' | { from: Date; to: Date; dateOnly: boolean } | null;

/** What Apply sends for a chosen preset (or none) and the panel's days and times. */
export function selectionRange(
  presetId: string | null,
  from: Date | null,
  to: Date | null,
  fromTime: string,
  toTime: string,
  now: Date = new Date(),
): Selection {
  if (presetId === CURRENT_SHIFT) return 'live';
  if (!from || !to) return null;
  if (aggregatesOnly(from, now)) return { from: startOfDay(from), to: endOfDay(to), dateOnly: true };
  const f = new Date(from);
  const t = new Date(to);
  const [fh, fm] = fromTime.split(':').map(Number);
  const [th, tm] = toTime.split(':').map(Number);
  f.setHours(fh, fm, 0, 0);
  t.setHours(th, tm, 59, 999);
  return { from: f, to: t, dateOnly: false };
}

/** A preset taken at once (phones): what the panel sends after picking it and Apply. */
export function presetSelection(preset: Preset, now: Date = new Date()): Selection {
  const { from, to } = preset.getDates();
  return selectionRange(preset.id, startOfDay(from), endOfDay(to), format(from, 'HH:mm'), format(to, 'HH:mm'), now);
}
