/**
 * The Predictive maintenance page's words and figures from the API's response (types.ts
 * MaintenanceOverview): each condition's word and tone, what each sign says, the pie of
 * conditions, the service kinds. Pure, so every figure shown is tested.
 */
import { SLICE_COLORS, type Slice } from '@/components/charts/donut-chart';
import type { Tone } from '@/components/ui/simple';
import type { Translate } from '@/lib/pie-slices';
import type { MaintenanceMachine, MaintenanceOverview, MaintenanceSign } from '@/lib/types';

export type TranslatePlural = (count: number, one: string, other: string, vars?: Record<string, string | number>) => string;

/** The conditions in pie order, their words and tones. */
export const CONDITIONS: ReadonlyArray<{ key: MaintenanceMachine['condition']; word: string; tone: Tone }> = [
  { key: 'healthy', word: 'Healthy', tone: 'good' },
  { key: 'watch', word: 'Watch', tone: 'warn' },
  { key: 'soon', word: 'Service soon', tone: 'warn' },
  { key: 'now', word: 'Service now', tone: 'bad' },
  { key: 'no_data', word: 'No data', tone: 'idle' },
];
const CONDITION_COLOR: Record<MaintenanceMachine['condition'], string> = {
  healthy: SLICE_COLORS.good, watch: '#fbbf24', soon: SLICE_COLORS.warn, now: SLICE_COLORS.bad, no_data: SLICE_COLORS.idle,
};

export function conditionInfo(condition: MaintenanceMachine['condition']) {
  return CONDITIONS.find((c) => c.key === condition) ?? CONDITIONS[CONDITIONS.length - 1];
}

/** The pie: machines by condition. */
export function conditionSlices(overview: Pick<MaintenanceOverview, 'summary'>, t: Translate): Slice[] {
  return CONDITIONS.map((c) => ({ label: t(c.word), value: overview.summary.conditions[c.key] ?? 0, color: CONDITION_COLOR[c.key] }));
}

/** The kinds of service a person can record, in the form's order. */
export const SERVICE_KINDS = ['service', 'bearing', 'belt', 'lubrication', 'cleaning', 'repair', 'inspection', 'other'] as const;
export const SERVICE_KIND_WORD: Record<(typeof SERVICE_KINDS)[number], string> = {
  service: 'General service', bearing: 'Bearing change', belt: 'Belt change', lubrication: 'Lubrication', cleaning: 'Cleaning',
  repair: 'Repair', inspection: 'Inspection', other: 'Other',
};

const num = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '—' : Number(v).toFixed(digits).replace(/\.0$/, ''));
const signed = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${v > 0 ? '+' : ''}${v}%`);

/** What a sign says, in one short line, from its codes and figures. */
export function signText(sign: MaintenanceSign, t: Translate): string {
  const { kind, codes, value, baseline, change_pct: change } = sign;
  const has = (code: string) => codes.includes(code);
  if (kind === 'vibration') {
    const zone = has('vibration_alarm') ? t('alarm zone') : has('vibration_warning') ? t('warning zone') : t('good zone');
    const level = t('Vibration {value} mm/s, {zone}', { value: num(value), zone });
    return has('vibration_rising') ? `${level} · ${t('up {change} this week', { change: signed(change) })}` : level;
  }
  if (kind === 'temperature') {
    const band = has('temperature_hot') ? t('hot') : has('temperature_warm') ? t('warm') : t('normal');
    const level = t('Temperature {value} °C, {band}', { value: num(value), band });
    return has('temperature_rising') ? `${level} · ${t('up {delta} °C today', { delta: num(Number(value) - Number(baseline)) })}` : level;
  }
  if (kind === 'load') {
    if (has('load_steady')) return t('Motor load steady at {value} A', { value: num(value) });
    return t('Motor load {change} against its first month ({value} A, was {baseline} A)', { change: signed(change), value: num(value), baseline: num(baseline) });
  }
  if (kind === 'stops') {
    if (has('stops_steady')) return t('{value} stops a day', { value: num(value) });
    return baseline ? t('{value} stops a day, was {baseline}', { value: num(value), baseline: num(baseline) }) : t('{value} stops a day', { value: num(value) });
  }
  if (kind === 'service') {
    if (has('service_overdue')) return t('Service overdue: {value} h run of {baseline} h', { value: num(value, 0), baseline: num(baseline, 0) });
    if (has('service_due')) return t('Service due: {value} h run of {baseline} h', { value: num(value, 0), baseline: num(baseline, 0) });
    return t('{value} h run since service, of {baseline} h', { value: num(value, 0), baseline: num(baseline, 0) });
  }
  return `${kind} ${num(value)}`;
}

/** The tone of a sign, from its severity. */
export function signTone(sign: Pick<MaintenanceSign, 'severity'>): Tone {
  return sign.severity >= 3 ? 'bad' : sign.severity >= 1 ? 'warn' : 'good';
}

/** The sentence on top: how many machines need a service, else how many to watch, else all well. */
export function overviewWords(overview: Pick<MaintenanceOverview, 'summary'>, t: Translate, tn: TranslatePlural): { tone: Tone; title: string; subtitle: string } {
  const c = overview.summary.conditions;
  const now = c.now ?? 0;
  const soon = c.soon ?? 0;
  const watch = c.watch ?? 0;
  const withData = overview.summary.machines - (c.no_data ?? 0);
  const subtitle = t('{count} of {total} machines have signs to read', { count: withData, total: overview.summary.machines });
  if (withData === 0) return { tone: 'idle', title: t('No signs yet'), subtitle: t('Signs come from current sensors, probes, vibration sensors and the service log.') };
  if (now > 0) return { tone: 'bad', title: tn(now, '{count} machine needs a service now', '{count} machines need a service now', { count: now }), subtitle };
  if (soon > 0) return { tone: 'warn', title: tn(soon, '{count} machine needs a service soon', '{count} machines need a service soon', { count: soon }), subtitle };
  if (watch > 0) return { tone: 'warn', title: tn(watch, '{count} machine to watch', '{count} machines to watch', { count: watch }), subtitle };
  return { tone: 'good', title: t('Every machine looks healthy'), subtitle };
}

/** When the next service falls due, in words. */
export function nextServiceWords(machine: Pick<MaintenanceMachine, 'next_service' | 'service_interval_hours'>, t: Translate, tn: TranslatePlural): string | null {
  const next = machine.next_service;
  if (!next) return machine.service_interval_hours ? null : t('No service interval set');
  if (next.hours_left <= 0) return t('Service overdue by {hours} h', { hours: Math.abs(next.hours_left) });
  if (next.days_left !== null) return tn(next.days_left, 'Next service in about {count} day ({hours} h)', 'Next service in about {count} days ({hours} h)', { count: next.days_left, hours: next.hours_left });
  return t('Next service in {hours} running hours', { hours: next.hours_left });
}
