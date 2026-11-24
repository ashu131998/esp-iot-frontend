/**
 * The factory Alerts page's react-query keys, windows and page sizes, shared by the page (which
 * fetches them all on the server, so the page arrives whole instead of four sections popping in
 * one after another) and the sections (which read and refresh them in the browser). One place, so
 * the two cannot drift: the machine section's key once differed by its last part, and the browser
 * fetched everything again behind a skeleton that then jumped (measured 2026-11-24: layout shift 0.78).
 */
import { dashboardNow } from '@/lib/date-range';

/** How far back the stop follow-up figures look. */
export const FOLLOW_UP_DAYS = 7;
/** How many stops the "Recent stops" list shows. */
export const DOWNTIME_REPORTS_LIMIT = 15;
/** How many entries the notification history shows. */
export const NOTIFICATIONS_LIMIT = 30;
/** The lines the filter offers (one request, as the other pages'). */
export const FILTER_LINES_LIMIT = 200;
/** The workers a test alert can be sent to. */
export const TEST_WORKERS_LIMIT = 200;

const DAY_MS = 86_400_000;

export const alertsQueryKeys = {
  /** `maxDate`: the end of what this viewer may see (an ended subscription), else null. */
  machines: (factoryId: string, maxDate: string | null) => ['availability-factory-alerts', factoryId, maxDate] as const,
  settings: (factoryId: string) => ['alert-settings', factoryId] as const,
  testWorkers: (factoryId: string) => ['workers', factoryId, 'alert-test'] as const,
  downtimeReports: (factoryId: string) => ['downtime-reports', factoryId] as const,
  downtimeReasons: (factoryId: string) => ['downtime-reasons', factoryId] as const,
  stopFollowUp: (factoryId: string) => ['stop-follow-up', factoryId, FOLLOW_UP_DAYS] as const,
  /** Every follow-up figure of the factory, whatever its window (to refresh them all after a change). */
  stopFollowUpAll: (factoryId: string) => ['stop-follow-up', factoryId] as const,
  notifications: (factoryId: string) => ['notifications', factoryId] as const,
  filterLines: (factoryId: string) => ['factory-lines', factoryId] as const,
  filterMachines: (factoryId: string, lineFilter: string) => ['factory-machines', factoryId, lineFilter] as const,
};

/** The machine section's window: the last 24 hours, ending at the end of what this viewer may see. */
export function alertsMachinesWindow(maxDate: string | null): { from: string; to: string } {
  const end = dashboardNow(maxDate);
  return { from: new Date(end.getTime() - DAY_MS).toISOString(), to: end.toISOString() };
}

/** The follow-up figures' window: the last FOLLOW_UP_DAYS days up to `now`. */
export function stopFollowUpWindow(now: Date = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - FOLLOW_UP_DAYS * DAY_MS).toISOString(), to: now.toISOString() };
}
