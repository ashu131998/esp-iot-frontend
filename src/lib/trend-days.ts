import { format } from 'date-fns';

import { productionDayStart } from '@/lib/date-range';
import type { MachineDailyTrendDay } from '@/lib/types';

/**
 * One day of a machine's trend, keyed 'yyyy-MM-dd'. `is_live`: it is today, still
 * running. `from_live`: its figures come from the live calculation (today, or a
 * recent day whose shifts are not saved yet), so they may still change.
 */
export type TrendDay = MachineDailyTrendDay & { key: string; is_live: boolean; from_live: boolean };

/**
 * The days a machine's trend shows — the chart and the table alike — within the
 * selected range. A settled day comes from the saved shift totals; today, and a
 * recent day not saved yet, from the live calculation. A day is taken whole from
 * one source, so its availability, speed, performance and units always agree.
 */
export function mergeTrendDays(
  saved: MachineDailyTrendDay[],
  live: MachineDailyTrendDay[] | undefined,
  { from, to, today }: { from: string; to: string; today: string },
): TrendDay[] {
  const inRange = (key: string) => key >= from && key <= to;
  const days = new Map<string, TrendDay>();
  for (const d of saved) {
    const key = d.date.slice(0, 10);
    if (inRange(key)) days.set(key, { ...d, key, is_live: key === today, from_live: false });
  }
  for (const d of live ?? []) {
    const key = d.date.slice(0, 10);
    if (inRange(key) && (key === today || !days.has(key))) {
      days.set(key, { ...d, key, is_live: key === today, from_live: true });
    }
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * The selected range as day keys. The URL's dates are India wall-clock, so their first
 * ten characters are the day; without them (live) the range runs from the production
 * day's start to today.
 */
export function trendDayRange(from: string | undefined, to: string | undefined, now: Date = new Date()) {
  const today = format(now, 'yyyy-MM-dd');
  return {
    from: from ? from.slice(0, 10) : format(productionDayStart(now), 'yyyy-MM-dd'),
    to: to ? to.slice(0, 10) : today,
    today,
  };
}
