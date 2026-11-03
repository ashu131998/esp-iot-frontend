/**
 * What the dashboard's pies show, as slices (charts/donut-chart.tsx): machines by running time, a
 * period's running / stopped time, energy by line or machine, stops by reason. Pure, so each split is tested.
 */
import { SLICE_COLORS, type Slice } from '@/components/charts/donut-chart';
import { RUN_BAD_PCT, RUN_WARN_PCT } from '@/lib/plain-words';

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Machines by how much of the period they ran, with the dashboard's running-time colours (Alerts'
 * cut-offs): 85 % or more, 70 to 85 %, under 70 %, and no data. Always all four, in that order.
 */
export function runShareSlices(percents: Array<number | null | undefined>, t: Translate): Slice[] {
  const counts = { good: 0, warn: 0, bad: 0, idle: 0 };
  for (const p of percents) {
    if (p === null || p === undefined || !Number.isFinite(p)) counts.idle += 1;
    else if (p >= RUN_WARN_PCT) counts.good += 1;
    else if (p >= RUN_BAD_PCT) counts.warn += 1;
    else counts.bad += 1;
  }
  return [
    { label: t('Ran {pct}% or more', { pct: RUN_WARN_PCT }), value: counts.good, color: SLICE_COLORS.good },
    { label: t('Ran {low}–{high}%', { low: RUN_BAD_PCT, high: RUN_WARN_PCT }), value: counts.warn, color: SLICE_COLORS.warn },
    { label: t('Ran under {pct}%', { pct: RUN_BAD_PCT }), value: counts.bad, color: SLICE_COLORS.bad },
    { label: t('No data'), value: counts.idle, color: SLICE_COLORS.idle },
  ];
}

/** A period's time: ran against stood still, in minutes. */
export function timeSplitSlices(uptimeMinutes: number, downtimeMinutes: number, t: Translate): Slice[] {
  return [
    { label: t('Running'), value: Math.max(0, uptimeMinutes), color: SLICE_COLORS.good },
    { label: t('Stopped'), value: Math.max(0, downtimeMinutes), color: SLICE_COLORS.bad },
  ];
}

/**
 * Energy by line: each line's kWh (its machines' sum), largest first; lines with no energy left
 * out. `lineName` gives a line's name for its ID.
 */
export function lineEnergySlices(
  machines: Array<{ line_id: string; energy_kwh: number | null }>,
  lineName: (lineId: string) => string,
): Slice[] {
  const byLine = new Map<string, number>();
  for (const m of machines) byLine.set(m.line_id, (byLine.get(m.line_id) ?? 0) + (m.energy_kwh ?? 0));
  return [...byLine.entries()]
    .filter(([, kwh]) => kwh > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([lineId, kwh], i) => ({ label: lineName(lineId), value: Math.round(kwh * 10) / 10, color: SLICE_COLORS.series[i % SLICE_COLORS.series.length] }));
}

/** Energy by machine (a line's page): the `keep` largest and the rest as one slice; none for no energy. */
export function machineEnergySlices(
  machines: Array<{ machine_name: string; energy_kwh: number | null }>,
  t: Translate,
  keep = 7,
): Slice[] {
  const used = machines.filter((m) => (m.energy_kwh ?? 0) > 0).sort((a, b) => (b.energy_kwh ?? 0) - (a.energy_kwh ?? 0));
  const slices: Slice[] = used.slice(0, keep).map((m, i) => ({
    label: m.machine_name, value: Math.round((m.energy_kwh ?? 0) * 10) / 10, color: SLICE_COLORS.series[i % SLICE_COLORS.series.length],
  }));
  const rest = used.slice(keep).reduce((s, m) => s + (m.energy_kwh ?? 0), 0);
  if (rest > 0) slices.push({ label: t('Other machines'), value: Math.round(rest * 10) / 10, color: SLICE_COLORS.idle });
  return slices;
}

/** Stops by reason: the top `keep` reasons and the rest as one slice; no reason given is a reason. */
export function reasonSlices(
  reasons: Array<{ label: string | null; stops: number }>,
  t: Translate,
  keep = 5,
): Slice[] {
  const sorted = [...reasons].filter((r) => r.stops > 0).sort((a, b) => b.stops - a.stops);
  const top = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((s, r) => s + r.stops, 0);
  const slices: Slice[] = top.map((r, i) => ({
    label: r.label ?? t('No reason given'), value: r.stops, color: SLICE_COLORS.series[i % SLICE_COLORS.series.length],
  }));
  if (rest > 0) slices.push({ label: t('Other reasons'), value: rest, color: SLICE_COLORS.idle });
  return slices;
}
