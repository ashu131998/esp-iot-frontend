/**
 * A factory's subscription as our staff see and edit it (the API's subscriptions.js has the
 * rules). Dates are calendar days written YYYY-MM-DD; a period covers its end date whole, in
 * India time. Pure helpers, unit-tested.
 */

export type SubscriptionState = 'none' | 'active' | 'ending' | 'ended';

export interface SubscriptionStatus {
  state: SubscriptionState;
  period_id?: number | null;
  starts_on?: string;
  ends_on?: string;
  /** 0 on the last day, negative after it. */
  days_left?: number;
  /** The last instant the factory's users see data for (ISO). */
  data_until?: string;
}

export interface SubscriptionPeriod {
  id: number;
  factory_id: string;
  starts_on: string;
  ends_on: string;
  plan: string | null;
  machines: number | null;
  monthly_amount: number | null;
  notes: string | null;
  reminders_sent: Record<string, string>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionResponse {
  factory_id: string;
  status: SubscriptionStatus;
  periods: SubscriptionPeriod[];
}

/** The staff form, as typed. */
export interface PeriodDraft {
  starts_on: string;
  ends_on: string;
  plan: string;
  machines: string;
  monthly_amount: string;
  notes: string;
}

export interface PeriodBody {
  starts_on: string;
  ends_on: string;
  plan: string | null;
  machines: number | null;
  monthly_amount: number | null;
  notes: string | null;
}

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'idle';

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `value` is a real calendar day written YYYY-MM-DD. */
export function isDayKey(value: string): boolean {
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d;
}

const toUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toKey = (date: Date) => date.toISOString().slice(0, 10);

/** The day key `days` calendar days after `key` (before, when negative). */
export function addDays(key: string, days: number): string {
  const at = toUtc(key);
  at.setUTCDate(at.getUTCDate() + days);
  return toKey(at);
}

/** The same day `months` calendar months later, kept inside a shorter month (31 Jan + 1 → 28 Feb). */
export function addMonths(key: string, months: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return toKey(first);
}

/** A period of `months` months starting on `startsOn`: it ends the day before the same date. */
export function periodEnd(startsOn: string, months: number): string {
  return addDays(addMonths(startsOn, months), -1);
}

const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "1 Dec 2026" (a calendar day: never shifted by the viewer's time zone). */
export function formatDay(key: string): string {
  return isDayKey(key) ? dayFmt.format(toUtc(key)) : key;
}

/** "1 Nov – 1 Dec 2026", or with both years when they differ. */
export function formatPeriod(startsOn: string, endsOn: string): string {
  const a = formatDay(startsOn);
  const b = formatDay(endsOn);
  return startsOn.slice(0, 4) === endsOn.slice(0, 4) ? `${a.replace(/ \d{4}$/, '')} – ${b}` : `${a} – ${b}`;
}

/** The badge for a subscription: what our staff need to see at a glance. */
export function subscriptionBadge(status: SubscriptionStatus | null | undefined): { label: string; tone: BadgeTone } {
  if (!status || status.state === 'none' || !status.ends_on) return { label: 'No subscription', tone: 'idle' };
  const end = formatDay(status.ends_on);
  if (status.state === 'ended') return { label: `Ended ${end}`, tone: 'bad' };
  if (status.state === 'ending') {
    const days = status.days_left ?? 0;
    if (days <= 0) return { label: 'Ends today', tone: 'warn' };
    if (days === 1) return { label: 'Ends tomorrow', tone: 'warn' };
    return { label: `Ends in ${days} days (${end})`, tone: 'warn' };
  }
  return { label: `Active · ends ${end}`, tone: 'ok' };
}

/** The current period: the one that ends last (as the API decides). */
export function currentPeriod(periods: ReadonlyArray<SubscriptionPeriod>): SubscriptionPeriod | null {
  let best: SubscriptionPeriod | null = null;
  for (const p of periods) {
    if (!best || p.ends_on > best.ends_on || (p.ends_on === best.ends_on && p.starts_on > best.starts_on)) best = p;
  }
  return best;
}

/**
 * The next period, pre-filled: from the day after the current one ends (so a late renewal
 * also opens the data recorded meanwhile), for a month, on the same plan; from today when
 * there is none.
 */
export function nextPeriodDraft(periods: ReadonlyArray<SubscriptionPeriod>, today: string): PeriodDraft {
  const current = currentPeriod(periods);
  const startsOn = current ? addDays(current.ends_on, 1) : today;
  return {
    starts_on: startsOn,
    ends_on: periodEnd(startsOn, 1),
    plan: current?.plan ?? '',
    machines: current?.machines != null ? String(current.machines) : '',
    monthly_amount: current?.monthly_amount != null ? String(current.monthly_amount) : '',
    notes: '',
  };
}

/** An existing period, as the form shows it. */
export function draftOf(p: SubscriptionPeriod): PeriodDraft {
  return {
    starts_on: p.starts_on,
    ends_on: p.ends_on,
    plan: p.plan ?? '',
    machines: p.machines != null ? String(p.machines) : '',
    monthly_amount: p.monthly_amount != null ? String(p.monthly_amount) : '',
    notes: p.notes ?? '',
  };
}

/** What is wrong with the form, field by field (the API checks the same). */
export function draftProblems(d: PeriodDraft): Partial<Record<keyof PeriodDraft, string>> {
  const out: Partial<Record<keyof PeriodDraft, string>> = {};
  if (!isDayKey(d.starts_on)) out.starts_on = 'Pick a start date';
  if (!isDayKey(d.ends_on)) out.ends_on = 'Pick an end date';
  else if (isDayKey(d.starts_on) && d.ends_on < d.starts_on) out.ends_on = 'Ends before it starts';
  if (d.machines.trim() && !/^\d+$/.test(d.machines.trim())) out.machines = 'A whole number';
  if (d.monthly_amount.trim() && !(Number(d.monthly_amount) >= 0)) out.monthly_amount = 'A number';
  if (d.plan.length > 80) out.plan = 'At most 80 characters';
  if (d.notes.length > 500) out.notes = 'At most 500 characters';
  return out;
}

/** The form as the API takes it. */
export function draftBody(d: PeriodDraft): PeriodBody {
  const text = (v: string) => v.replace(/\s+/g, ' ').trim() || null;
  return {
    starts_on: d.starts_on,
    ends_on: d.ends_on,
    plan: text(d.plan),
    machines: d.machines.trim() ? Number(d.machines.trim()) : null,
    monthly_amount: d.monthly_amount.trim() ? Number(d.monthly_amount) : null,
    notes: text(d.notes),
  };
}

/** Today's date in India (the app's timezone), YYYY-MM-DD. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Where customers go to renew. */
export const SALES_EMAIL = 'sales@floorbeat.in';

export type SubscriptionBar =
  | { kind: 'ended'; ends_on: string }
  | { kind: 'ended-staff'; ends_on: string }
  | { kind: 'ending'; ends_on: string; days_left: number };

/**
 * The bar a factory's dashboard shows about its subscription, or null. Once it has ended,
 * everyone sees why the data stops (our staff see that they are not limited). In its last 30
 * days only those who can renew see it coming: the factory's admins and our staff.
 */
export function subscriptionBar(
  status: SubscriptionStatus | null | undefined,
  viewer: { staff: boolean; canRenew: boolean },
): SubscriptionBar | null {
  if (!status?.ends_on) return null;
  if (status.state === 'ended') return { kind: viewer.staff ? 'ended-staff' : 'ended', ends_on: status.ends_on };
  if (status.state === 'ending' && (viewer.staff || viewer.canRenew)) {
    return { kind: 'ending', ends_on: status.ends_on, days_left: status.days_left ?? 0 };
  }
  return null;
}

/** A calendar day as an instant at noon in India, for the locale date formatters (no day shift). */
export function dayAsInstant(key: string): Date {
  return new Date(`${key}T12:00:00+05:30`);
}
