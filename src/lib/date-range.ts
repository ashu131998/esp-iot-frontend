import {
  endOfDay,
  format,
  isValid,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
} from 'date-fns';

import { DEFAULT_SHIFTS } from '@/lib/shifts';

export const DATE_PARAM_FROM = 'from';
export const DATE_PARAM_TO = 'to';

/** Production "today" starts at day-shift open (06:00 → next 06:00). */
export const PRODUCTION_DAY_START_HOUR = DEFAULT_SHIFTS[0].start_hour;

/** Status timeline always shows this rolling window (uptime page exception). */
export const UPTIME_TIMELINE_HOURS = 24;

export type DateRangeSearchParams = {
  from?: string;
  to?: string;
};

export type DateRangePreset = 'today' | '7d' | '30d' | '90d' | '6m' | 'all';

export interface ResolvedDateRange {
  from: string;
  to: string;
}

export function parseMinDate(minDate?: string | Date | null): Date | null {
  if (!minDate) return null;
  const d = minDate instanceof Date ? minDate : parseISO(String(minDate));
  return isValid(d) ? d : null;
}

export function toDateInputValue(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

export function fromDateInputValue(value: string, end = false): string {
  const d = parseISO(value);
  return (end ? endOfDay(d) : startOfDay(d)).toISOString();
}

/** Start of the current production day (day shift open → next day shift open). */
export function productionDayStart(ref: Date = new Date()): Date {
  const start = new Date(ref);
  start.setHours(PRODUCTION_DAY_START_HOUR, 0, 0, 0);
  if (ref.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}

/** Rolling wall-clock window for the uptime status timeline. */
export function last24HoursRange(ref: Date = new Date()): ResolvedDateRange {
  return {
    from: new Date(ref.getTime() - UPTIME_TIMELINE_HOURS * 3600000).toISOString(),
    to: ref.toISOString(),
  };
}

/** Live window for production "today": day shift open through now. */
export function todayProductionRange(ref: Date = new Date()): ResolvedDateRange {
  return {
    from: productionDayStart(ref).toISOString(),
    to: ref.toISOString(),
  };
}

/**
 * Resolve URL search params into ISO from/to bounds.
 * Default: rolling last 24 hours (now − 24h → now).
 */
export function resolveDateRange(
  params: DateRangeSearchParams,
  minDate?: string | Date | null,
): ResolvedDateRange {
  const now = new Date();
  const min = parseMinDate(minDate);

  if (!params.from && !params.to) {
    // Default to a rolling last-24h window: it re-resolves against "now" on
    // every render/refetch, so a dashboard left open keeps sliding forward
    // instead of pinning to a shift or production day.
    let start = new Date(now.getTime() - UPTIME_TIMELINE_HOURS * 3600000);
    if (min && start < min) start = min;
    if (start > now) start = now;
    return { from: start.toISOString(), to: now.toISOString() };
  }

  let end = now;
  if (params.to) {
    const parsed = parseISO(params.to);
    // Preserve an explicit time component (e.g. "2025-01-10T17:00"); otherwise snap to end-of-day.
    if (isValid(parsed)) end = params.to.includes('T') ? parsed : endOfDay(parsed);
  }

  let start: Date;
  if (params.from) {
    const parsed = parseISO(params.from);
    // Preserve an explicit time component; otherwise snap to start-of-day.
    if (isValid(parsed)) {
      start = params.from.includes('T') ? parsed : startOfDay(parsed);
    } else {
      start = productionDayStart(end);
    }
  } else {
    start = productionDayStart(end);
  }

  if (min && start < min) start = min;
  if (start > end) start = productionDayStart(end);

  return { from: start.toISOString(), to: end.toISOString() };
}

export function presetRange(
  preset: DateRangePreset,
  minDate?: string | Date | null,
): ResolvedDateRange {
  const now = new Date();
  const end = now.toISOString();
  const min = parseMinDate(minDate);

  let start: Date;
  switch (preset) {
    case 'today': {
      const range = todayProductionRange(now);
      let start = parseISO(range.from);
      if (min && start < min) start = min;
      return { from: start.toISOString(), to: range.to };
    }
    case '7d':
      start = startOfDay(subDays(now, 7));
      break;
    case '30d':
      start = startOfDay(subDays(now, 30));
      break;
    case '90d':
      start = startOfDay(subDays(now, 90));
      break;
    case '6m':
      start = startOfDay(subMonths(now, 6));
      break;
    case 'all':
      start = min ? startOfDay(min) : startOfDay(subMonths(now, 6));
      break;
    default:
      start = startOfDay(subDays(now, 30));
  }

  if (min && start < min) start = startOfDay(min);

  return { from: start.toISOString(), to: end };
}

export function formatRangeLabel(from: string, to: string): string {
  const start = parseISO(from);
  const end = parseISO(to);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth && start.getDate() === end.getDate()) {
    return format(start, 'MMM d, yyyy');
  }
  if (sameYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

export function rangeDurationLabel(from: string, to: string): string {
  const ms = parseISO(to).getTime() - parseISO(from).getTime();
  const hours = ms / 3600000;
  if (hours < 48) return `${Math.round(hours)}h window`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} day window`;
  const months = Math.round(days / 30);
  return `${months} month window`;
}

export function isLiveRange(to: string): boolean {
  return parseISO(to).getTime() >= Date.now() - 60_000;
}

/** True when the range end tracks "now" (no explicit `to` in the URL). */
export function isLiveDateParams(params: DateRangeSearchParams): boolean {
  return !params.to;
}
