/**
 * The alerts app's pure rules: what an alert asks, how it is coloured, how the inbox is grouped,
 * and the app's own addresses. No React, no browser: tested in lib/__tests__/alerts-app.test.ts.
 */
import { APP_TZ } from '@/lib/shifts';

import type { AlertOption, MyAlert } from './types';

export const ALERTS_QUERY_KEY = ['me-alerts'] as const;
export const alertQueryKey = (id: string) => ['me-alert', id] as const;
export const PLANTS_QUERY_KEY = ['me-plants'] as const;

export type AlertTone = 'good' | 'warn' | 'bad' | 'idle';

/** The answers an alert offers, when it offers any. */
export function optionsOf(alert: Pick<MyAlert, 'payload'>): AlertOption[] {
  const list = alert.payload?.options;
  if (!Array.isArray(list)) return [];
  return list.filter((o): o is AlertOption => Boolean(o) && typeof o.id === 'string' && typeof o.label === 'string' && o.label.trim() !== '');
}

/** Whether the alert is still waiting for an answer from someone it went to. */
export function asksQuestion(alert: Pick<MyAlert, 'payload' | 'resolved_at'>): boolean {
  return optionsOf(alert).length > 0 && !alert.resolved_at;
}

/** The line the inbox shows: the title, else the message's first line, else what kind of alert it is. */
export function titleOf(alert: Pick<MyAlert, 'title' | 'message' | 'type'>): string {
  const title = (alert.title ?? '').trim();
  if (title) return title;
  const first = (alert.message ?? '').split('\n')[0].trim();
  return first || typeLabel(alert.type) || alert.type;
}

/** Red for a HIGH alert still open, amber for a MEDIUM one, green once answered, grey otherwise. */
export function severityTone(alert: Pick<MyAlert, 'severity' | 'resolved_at'>): AlertTone {
  if (alert.resolved_at) return 'good';
  const s = (alert.severity ?? '').toUpperCase();
  if (s === 'HIGH' || s === 'CRITICAL') return 'bad';
  if (s === 'MEDIUM') return 'warn';
  return 'idle';
}

/**
 * What kind of alert this is, in English (translated where shown): a machine that stopped, one
 * running again, a shift about to start, a test from the settings page; null for a kind with no
 * plain name (the title says it then).
 */
export function typeLabel(type: string | null | undefined): 'Machine stopped' | 'Machine running again' | 'Shift reminder' | 'Test alert' | null {
  const t = (type ?? '').toLowerCase();
  if (!t) return null;
  if (t === 'test') return 'Test alert';
  if (t.includes('shift')) return 'Shift reminder';
  if (t.includes('down')) return 'Machine stopped';
  if (t.includes('up')) return 'Machine running again';
  return null;
}

/** The calendar day of a time, in factory time (IST), as "YYYY-MM-DD". */
export function dayKeyOf(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** "Today" or "Yesterday" for a day key, in factory time; null for an older day (shown as a date). */
export function dayLabel(key: string, now: Date = new Date()): 'Today' | 'Yesterday' | null {
  if (key === dayKeyOf(now)) return 'Today';
  if (key === dayKeyOf(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return null;
}

export interface AlertGroups {
  /** Alerts still waiting for an answer, newest first: always at the top. */
  needsAnswer: MyAlert[];
  /** The rest by day, newest day and newest alert first. */
  days: Array<{ key: string; items: MyAlert[] }>;
}

const newestFirst = (a: MyAlert, b: MyAlert) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

/** The inbox's sections: the open questions, then every alert by its day. */
export function groupAlerts(items: MyAlert[]): AlertGroups {
  const sorted = [...items].sort(newestFirst);
  const needsAnswer = sorted.filter(asksQuestion);
  const days: AlertGroups['days'] = [];
  const byKey = new Map<string, AlertGroups['days'][number]>();
  for (const alert of sorted) {
    if (asksQuestion(alert)) continue;
    const key = dayKeyOf(alert.created_at);
    let group = byKey.get(key);
    if (!group) {
      group = { key, items: [] };
      byKey.set(key, group);
      days.push(group);
    }
    group.items.push(alert);
  }
  return { needsAnswer, days };
}

/** How many factories the alerts come from: a company's admin sees several, and then each row names its factory. */
export function factoriesIn(items: Array<Pick<MyAlert, 'factory_id'>>): number {
  return new Set(items.map((a) => a.factory_id)).size;
}

/** The row's second line: the machine, and the factory when the inbox spans several. */
export function whereLabel(alert: Pick<MyAlert, 'machine_name' | 'factory_name'>, manyFactories: boolean): string {
  return [alert.machine_name, manyFactories ? alert.factory_name : null].filter((s): s is string => Boolean(s && s.trim())).join(' · ');
}

/**
 * Where the app's pages are. On its own address (alerts.floorbeat.in) the pages are at plain
 * addresses ("/", "/settings"); opened at the app's inner address (a local run without the host:
 * /alerts-app/settings) they stay under /alerts-app. The pathname tells which.
 */
export function appBase(pathname: string | null | undefined): '' | '/alerts-app' {
  return /^\/alerts-app(\/|$)/.test(pathname ?? '') ? '/alerts-app' : '';
}

/** The pathname without the app's inner prefix: "/alerts-app/settings" → "/settings". */
export function appPath(pathname: string | null | undefined): string {
  const p = (pathname ?? '/').replace(/^\/alerts-app(?=\/|$)/, '');
  return p === '' ? '/' : p;
}

/** Whether a bottom-bar tab is the current page: the inbox owns "/" and every alert. */
export function tabActive(tab: 'inbox' | 'settings', pathname: string | null | undefined): boolean {
  const p = appPath(pathname);
  if (tab === 'settings') return p === '/settings' || p.startsWith('/settings/');
  return p === '/' || p === '/alerts' || p.startsWith('/alerts/');
}
