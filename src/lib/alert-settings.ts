/**
 * The dashboard's alert settings, the pure part: what a wait typed into the form becomes, whether a
 * test alert can be sent from here, and to whom. (The server keeps the same bounds:
 * query-api notify/escalation.js.)
 */
import type { AlertSettings, Worker } from '@/lib/types';

export const ESCALATE_MAX_MINUTES = 240;
export const ESCALATE_SUPERVISOR_MINUTES = 10;
export const ESCALATE_OWNER_MINUTES = 20;

/** A wait typed into the form as the server takes it: a whole number 0..240 (0 = never); null when it is not one. */
export function escalationMinutesInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0 || n > ESCALATE_MAX_MINUTES) return null;
  return n;
}

type Configured = Pick<AlertSettings, 'app_configured' | 'alertops_configured'> | null | undefined;

/** Whether a test alert can go to a worker from the dashboard: the alerts app (or the older bridge) is set up on the server. */
export function canTestAlerts(settings: Configured): boolean {
  return Boolean(settings?.app_configured || settings?.alertops_configured);
}

/** The workers a test alert can go to: with the alerts app, those who have a login for it. */
export function testableWorkers<W extends Pick<Worker, 'user_id'>>(workers: W[], settings: Configured): W[] {
  return settings?.app_configured ? workers.filter((w) => Boolean(w.user_id)) : workers;
}
