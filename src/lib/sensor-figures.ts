/**
 * The temperature and vibration pages' figures from the API's response (types.ts
 * SensorFiguresResponse): the words and colours of the bands and zones, each machine's row, the
 * trend's lines, the pie's slices and the sentence on top. Pure, so every figure shown is tested.
 */
import { SLICE_COLORS, type Slice } from '@/components/charts/donut-chart';
import type { Tone } from '@/components/ui/simple';
import type { Translate } from '@/lib/pie-slices';
import type { SensorFigure, SensorFiguresResponse, SensorKind, SensorMachine } from '@/lib/types';

export type TranslatePlural = (count: number, one: string, other: string, vars?: Record<string, string | number>) => string;

export const KIND_UNIT: Record<SensorKind, string> = { temperature: '°C', vibration: 'mm/s' };

/** The classes a machine falls in, in pie order, with their words and tones (the server's rules, query-api sensors.js). */
export const CLASSES: Record<SensorKind, ReadonlyArray<{ key: string; word: string; tone: Tone }>> = {
  temperature: [
    { key: 'normal', word: 'Normal', tone: 'good' },
    { key: 'warm', word: 'Warm', tone: 'warn' },
    { key: 'hot', word: 'Hot', tone: 'bad' },
    { key: 'unknown', word: 'No reading', tone: 'idle' },
  ],
  vibration: [
    { key: 'good', word: 'Good', tone: 'good' },
    { key: 'warning', word: 'Warning', tone: 'warn' },
    { key: 'alarm', word: 'Alarm', tone: 'bad' },
    { key: 'unknown', word: 'No reading', tone: 'idle' },
  ],
};

/** Where the warning and alarm classes begin, the chart's guide lines: 60 / 80 °C; 2.8 / 4.5 mm/s (ISO 10816-3 group 2, rigid). */
export const CLASS_LIMITS: Record<SensorKind, { warn: number; bad: number }> = {
  temperature: { warn: 60, bad: 80 },
  vibration: { warn: 2.8, bad: 4.5 },
};

export function classOf(machine: Pick<SensorMachine, 'band' | 'zone'>, kind: SensorKind): string {
  return (kind === 'temperature' ? machine.band : machine.zone) ?? 'unknown';
}

export function classInfo(kind: SensorKind, key: string) {
  return CLASSES[kind].find((c) => c.key === key) ?? CLASSES[kind][CLASSES[kind].length - 1];
}

/** The pie: the machines with a sensor by class, from the response's summary. */
export function classSlices(data: Pick<SensorFiguresResponse, 'kind' | 'summary'>, t: Translate): Slice[] {
  const counts = (data.kind === 'temperature' ? data.summary.bands : data.summary.zones) ?? {};
  return CLASSES[data.kind].map((c) => ({ label: t(c.word), value: counts[c.key] ?? 0, color: SLICE_COLORS[c.tone] }));
}

/** The main reading of a kind: temperature's celsius, vibration's velocity axes. */
export const isMainKey = (kind: SensorKind, key: string): boolean => (kind === 'temperature' ? key === 'celsius' : key.startsWith('vel_'));

export interface SensorRow {
  machine_id: string;
  machine_name: string;
  line_id: string;
  status: SensorMachine['status'];
  /** The machine's figure now (the server's: its highest sensor). */
  value: number | null;
  cls: string;
  min: number | null;
  max: number | null;
  avg: number | null;
  latest_at: string | null;
  sensors: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** One row per machine: its main figures over the window, over all its sensors (the hottest / strongest counts). */
export function machineRows(data: Pick<SensorFiguresResponse, 'kind' | 'machines'>): SensorRow[] {
  return data.machines.map((m) => {
    const figures = m.sensors.flatMap((s) => s.figures).filter((f) => isMainKey(data.kind, f.key));
    const known = (pick: (f: SensorFigure) => number | null) => figures.map(pick).filter((v): v is number => v !== null);
    const mins = known((f) => f.min);
    const maxes = known((f) => f.max);
    const measured = figures.filter((f) => f.avg !== null && f.samples > 0);
    const samples = measured.reduce((s, f) => s + f.samples, 0);
    const avg = samples > 0 ? round2(measured.reduce((s, f) => s + (f.avg as number) * f.samples, 0) / samples) : null;
    const latestAt = figures.map((f) => f.latest_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
    return {
      machine_id: m.machine_id, machine_name: m.machine_name, line_id: m.line_id, status: m.status, value: m.value,
      cls: classOf(m, data.kind), min: mins.length ? Math.min(...mins) : null, max: maxes.length ? Math.max(...maxes) : null,
      avg, latest_at: latestAt, sensors: m.sensors.length,
    };
  });
}

/** The rows with the highest value first; those without a value after, in their own order. */
export function highestFirst(rows: SensorRow[]): SensorRow[] {
  return [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
}

export interface TrendLine { name: string; data: [number, number][] }

/**
 * The trend: one line per machine, its strongest main-key stream (the hottest probe, the axis
 * with the highest latest velocity), the highest machines first, at most `max` lines.
 */
export function trendLines(data: Pick<SensorFiguresResponse, 'kind' | 'machines'>, max = 12): TrendLine[] {
  const lines: Array<{ name: string; latest: number; data: [number, number][] }> = [];
  for (const m of data.machines) {
    const figures = m.sensors.flatMap((s) => s.figures).filter((f) => isMainKey(data.kind, f.key) && f.series.length > 0);
    if (figures.length === 0) continue;
    const level = (f: SensorFigure) => f.latest ?? f.max ?? -Infinity;
    const best = figures.reduce((a, b) => (level(b) > level(a) ? b : a));
    lines.push({ name: m.machine_name, latest: level(best), data: best.series.map(([iso, v]) => [Date.parse(iso), v]) });
  }
  return lines.sort((a, b) => b.latest - a.latest).slice(0, max).map(({ name, data: points }) => ({ name, data: points }));
}

/** The sentence on top: how the machines stand, and its tone. */
export function summaryWords(
  data: Pick<SensorFiguresResponse, 'kind' | 'summary'>,
  t: Translate,
  tn: TranslatePlural,
): { tone: Tone; title: string; subtitle: string } {
  const { with_sensor: withSensor, reporting, machines } = data.summary;
  const temperature = data.kind === 'temperature';
  const counts = (temperature ? data.summary.bands : data.summary.zones) ?? {};
  const bad = counts[temperature ? 'hot' : 'alarm'] ?? 0;
  const warn = counts[temperature ? 'warm' : 'warning'] ?? 0;
  if (withSensor === 0) {
    return {
      tone: 'idle',
      title: t(temperature ? 'No machine has a temperature sensor yet' : 'No machine has a vibration sensor yet'),
      subtitle: t("Match a board's sensor channel to a machine on Sensor mapping."),
    };
  }
  const subtitle = t('{reporting} of {count} machines with a sensor are reporting', { reporting, count: withSensor });
  if (reporting === 0) return { tone: 'idle', title: t('No readings in this period'), subtitle: t('{count} of {total} machines have a sensor', { count: withSensor, total: machines }) };
  if (bad > 0) {
    return {
      tone: 'bad',
      title: temperature
        ? tn(bad, '{count} machine runs hot', '{count} machines run hot', { count: bad })
        : tn(bad, '{count} machine vibrates in the alarm zone', '{count} machines vibrate in the alarm zone', { count: bad }),
      subtitle,
    };
  }
  if (warn > 0) {
    return {
      tone: 'warn',
      title: temperature
        ? tn(warn, '{count} machine runs warm', '{count} machines run warm', { count: warn })
        : tn(warn, '{count} machine vibrates in the warning zone', '{count} machines vibrate in the warning zone', { count: warn }),
      subtitle,
    };
  }
  return { tone: 'good', title: t(temperature ? 'Every machine runs at a normal temperature' : 'Every machine vibrates in the good zone'), subtitle };
}
