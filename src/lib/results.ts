/**
 * Results: what Machine Monitoring as a Service gave a factory back (query-api src/results.js
 * works the figures out; this file only shapes them for the dashboard). Pure, so tested.
 *
 * - Recovered machine-hours: each machine's running share against its first month, times the hours it
 *   was watched. Negative when machines ran less than in the first month: shown as it is.
 * - Rupees and the service fee are for the factory's admins and our staff; the API leaves them
 *   out for everyone else.
 */
import type { Tone } from '@/components/ui/simple';
import { formatDecimal, formatInt, formatUpTo } from '@/lib/format';
import { localeTag, type Locale } from '@/lib/i18n/locale';
import { APP_TZ } from '@/lib/shifts';

export interface ResultsTotals {
  compared_machines: number;
  watched_hours: number;
  recovered_hours: number | null;
  baseline_running_pct: number | null;
  running_pct: number | null;
  stopped_hours: number | null;
  stopped_hours_at_baseline: number | null;
}

export interface ResultsMachine {
  machine_id: string;
  machine_name: string;
  line_id: string | null;
  baseline_hours: number;
  baseline_running_pct: number | null;
  hours: number;
  running_pct: number | null;
  recovered_hours: number | null;
  /** no_baseline: under a day watched in the first month; no_data: not watched this month. */
  status: 'compared' | 'no_baseline' | 'no_data';
}

export interface ServiceMoney {
  recovered_rupees: number | null;
  service_fee_rupees: number | null;
  net_rupees: number | null;
  return_multiple: number | null;
  setup_fee_rupees: number | null;
  payback_months: number | null;
  no_upfront_cost: boolean;
}

export interface StopReasonTotal {
  code: string | null;
  label: string | null;
  stops: number;
  minutes: number;
}

export interface StopFollowUp {
  factory_id?: string;
  from?: string;
  to?: string;
  stops: number;
  /** Stops whose alert reached at least one person; null when not known. */
  alerts: number | null;
  alerts_acted_on: number | null;
  alerts_acted_on_pct: number | null;
  acted_on: number;
  acted_on_pct: number | null;
  explained: number;
  explained_pct: number | null;
  fixed_confirmed: number;
  running_again: number;
  closed: number;
  still_stopped: number;
  median_minutes_to_reason: number | null;
  median_minutes_to_running: number | null;
  reasons: StopReasonTotal[];
}

export interface ResultsSettings {
  value_per_loom_hour: number | null;
  fee_per_machine_month: number | null;
  setup_fee: number | null;
  baseline_from: string | null;
  baseline_to: string | null;
  monthly_email: boolean;
  monthly_email_rupees: boolean;
  last_report_month: string | null;
  updated_at: string | null;
}

export interface ResultsBaseline {
  from: string;
  to: string;
  source: 'first_month' | 'set';
  ready: boolean;
  days_done: number;
  days_total: number;
  closed_shifts: number;
}

export interface ResultsResponse {
  factory_id: string;
  month: string;
  from: string;
  to: string;
  /** Months with data, newest first ('YYYY-MM'). */
  months: string[];
  machines_monitored: number;
  baseline: ResultsBaseline | null;
  /** The part of the month compared with the baseline (after it, up to now). */
  window: { from: string; to: string } | null;
  /** End of the last saved shift counted. */
  data_to: string | null;
  closed_shifts: number;
  totals: ResultsTotals | null;
  machines: ResultsMachine[];
  money: ServiceMoney | null;
  since_baseline: { from: string; to: string; totals: ResultsTotals; money: ServiceMoney | null } | null;
  stops: StopFollowUp | null;
  settings: ResultsSettings | null;
}

export type SetupStepKey = 'boards' | 'mapped' | 'live' | 'first_shift' | 'alerts' | 'reports' | 'value';

export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
  count?: number;
  of?: number;
  at?: string | null;
  required: boolean;
}

export interface SetupProgress {
  factory_id: string;
  day: number | null;
  days_promised: number;
  steps: SetupStep[];
  done: number;
  total: number;
  complete: boolean;
  status: 'on_track' | 'late' | 'done';
  /** The checklist is for this viewer (an admin or our staff) and the rollout is still open. */
  show: boolean;
}

const MINUS = '−';

/** "+10.8 h", "−3.3 h" (the size rounded, the sign kept), "0 h"; "—" when unknown. */
export function formatSignedHours(hours: number | null | undefined, locale: Locale = 'en'): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  const size = Math.round(Math.abs(hours) * 10) / 10;
  if (size === 0) return '0 h';
  return `${hours > 0 ? '+' : MINUS}${formatUpTo(size, 1, locale)} h`;
}

/** "₹1,44,340", "−₹1,200"; "—" when unknown. */
export function formatRupees(value: number | null | undefined, locale: Locale = 'en'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const size = Math.round(Math.abs(value));
  return `${value < 0 && size > 0 ? MINUS : ''}₹${formatInt(size, locale)}`;
}

/** "72.5%"; "—" when unknown. */
export function formatPct(value: number | null | undefined, locale: Locale = 'en'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatUpTo(value, 1, locale)}%`;
}

/** "October 2026" in the page's language. */
export function monthLabel(monthKey: string, locale: Locale = 'en'): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return monthKey;
  const mid = new Date(`${monthKey}-15T12:00:00+05:30`);
  return new Intl.DateTimeFormat(localeTag(locale), { month: 'long', year: 'numeric', timeZone: APP_TZ }).format(mid);
}

/** Green when machines ran more than in the first month, red when less, grey when unknown or even. */
export function recoveredTone(hours: number | null | undefined): Tone {
  if (hours == null || !Number.isFinite(hours) || Math.abs(hours) < 0.05) return 'idle';
  return hours > 0 ? 'good' : 'bad';
}

/** Where a rollout step is done in the dashboard; null for one that only needs time. */
export function setupStepHref(key: SetupStepKey, factoryId: string): string | null {
  const base = `/factories/${encodeURIComponent(factoryId)}`;
  switch (key) {
    case 'boards':
    case 'mapped':
      return `${base}/sensor-mapping`;
    case 'live':
      return `${base}/status-timeline`;
    case 'alerts':
      return `${base}/alerts`;
    case 'reports':
      return `${base}/shift-reports`;
    case 'value':
      return `${base}/results?settings=1`;
    default:
      return null;
  }
}

/**
 * An amount typed in the settings: "1,250", "₹ 350.5" → a number; '' → null (cleared);
 * anything else (letters, below zero) → undefined, i.e. not an amount.
 */
export function parseRupeesInput(text: string): number | null | undefined {
  const clean = text.replace(/[,\s₹]/g, '');
  if (clean === '') return null;
  if (!/^\d+(\.\d+)?$/.test(clean)) return undefined;
  return Number(clean);
}

/** "2026-10-01" (IST day) of an instant, for a date input. */
export function dayInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** The IST midnight starting a date input's day, as ISO; null for an empty or broken value. */
export function dayInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A case study in the format plant-monitoring vendors publish (hours saved, rupees saved,
 * payback, the customer's name), from the month's real figures. English: it goes into
 * proposals and onto floorbeat.in only with the customer's permission.
 */
export function caseStudyText({
  factoryName,
  location,
  results,
}: {
  factoryName: string;
  location?: string | null;
  results: ResultsResponse;
}): string {
  const t = results.totals;
  const money = results.money;
  const month = monthLabel(results.month, 'en');
  const lines: string[] = [];
  lines.push(`${factoryName}${location ? `, ${location}` : ''} — FloorBeat results, ${month}`);
  lines.push('');
  lines.push(`• Machines monitored: ${formatInt(results.machines_monitored)}`);
  if (t && t.recovered_hours != null) {
    lines.push(
      `• Machine-hours recovered in ${month}: ${formatSignedHours(t.recovered_hours)} against the first month `
      + `(running ${formatPct(t.baseline_running_pct)} → ${formatPct(t.running_pct)})`,
    );
  } else {
    lines.push('• Machine-hours recovered: still measuring the first month');
  }
  if (money?.recovered_rupees != null && results.settings?.value_per_loom_hour != null) {
    lines.push(`• Worth: ${formatRupees(money.recovered_rupees)} at ${formatRupees(results.settings.value_per_loom_hour)} a machine-hour`);
  }
  if (money?.service_fee_rupees != null) {
    const multiple = money.return_multiple != null ? ` — returned ${formatDecimal(money.return_multiple, 1)}×` : '';
    lines.push(`• Service fee for the period: ${formatRupees(money.service_fee_rupees)}${multiple}`);
  }
  if (money) {
    if (money.no_upfront_cost) lines.push('• Upfront cost: none (Machine Monitoring as a Service)');
    else if (money.payback_months != null) lines.push(`• Setup fee paid back in ${formatUpTo(money.payback_months, 1)} months`);
  }
  const since = results.since_baseline;
  if (since?.totals.recovered_hours != null) {
    const worth = since.money?.recovered_rupees != null ? `, worth ${formatRupees(since.money.recovered_rupees)}` : '';
    lines.push(`• Since the first month: ${formatSignedHours(since.totals.recovered_hours)}${worth}`);
  }
  const s = results.stops;
  if (s && s.alerts != null && s.alerts > 0) {
    const median = s.median_minutes_to_running != null
      ? `, running again in a median of ${formatUpTo(s.median_minutes_to_running, 0)} minutes`
      : '';
    lines.push(`• Stop alerts acted on: ${formatInt(s.alerts_acted_on ?? 0)} of ${formatInt(s.alerts)} (${formatPct(s.alerts_acted_on_pct)})${median}`);
  }
  lines.push('');
  lines.push('Machine Monitoring as a Service by FloorBeat — floorbeat.in');
  return lines.join('\n');
}

/** React Query keys shared by the server prefetch (overview page) and the cards. */
export const resultsQueryKey = (factoryId: string, month: string | null = null) =>
  ['results', factoryId, month ?? 'current'] as const;
export const setupProgressQueryKey = (factoryId: string) => ['setup-progress', factoryId] as const;
