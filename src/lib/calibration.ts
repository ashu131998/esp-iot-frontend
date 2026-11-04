/**
 * The rules behind the Calibrate wizard (components/factory/calibration-wizard.tsx): what the
 * measured current levels of a machine (off, idle, running) turn into, and what one measured run says
 * about pulses per unit. Pure functions, so every rule is tested.
 */

export interface LevelSummary {
  windows: number;
  mean_a: number;
  min_a: number;
  max_a: number;
}

export interface SampleWindow {
  occurred_at: string;
  amps: number | null;
  amps_min: number | null;
  amps_max: number | null;
  samples?: number | null;
  window_s?: number | null;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Mean of the window averages, lowest low, highest high; null without usable windows. */
export function summarizeWindows(windows: ReadonlyArray<SampleWindow> | null | undefined): LevelSummary | null {
  const rows = (windows ?? []).filter((w) => finite(w.amps));
  if (rows.length === 0) return null;
  const amps = rows.map((w) => w.amps as number);
  const lows = rows.map((w) => (finite(w.amps_min) ? w.amps_min : (w.amps as number)));
  const highs = rows.map((w) => (finite(w.amps_max) ? w.amps_max : (w.amps as number)));
  return {
    windows: rows.length,
    mean_a: round(amps.reduce((s, a) => s + a, 0) / amps.length, 3),
    min_a: round(Math.min(...lows), 3),
    max_a: round(Math.max(...highs), 3),
  };
}

export interface Levels {
  off: LevelSummary | null;
  idle: LevelSummary | null;
  running: LevelSummary | null;
}

export interface Proposal {
  on_threshold_a: number | null;
  off_below_a: number | null;
  /** English keys for t(); `{gap}` carries the small gap in amps as text. */
  warnings: string[];
  gap_a: number | null;
}

export const MIN_ON_THRESHOLD_A = 0.05;
export const SMALL_GAP_A = 0.1;

/**
 * Thresholds from the measured levels. Running is required. The on threshold sits halfway between
 * the highest "stopped" reading (idle if measured, else off) and the lowest running reading; when
 * those overlap (a bad clamp, a motor that never really stops) it falls back to halfway between
 * the two averages and says so. The off threshold needs both off and idle, halfway between them.
 */
export function proposeThresholds({ off, idle, running }: Levels): Proposal {
  const warnings: string[] = [];
  if (!running) {
    return { on_threshold_a: null, off_below_a: null, warnings: ['Measure the machine running first.'], gap_a: null };
  }
  const stopped = idle ?? off;
  const stoppedMax = stopped?.max_a ?? 0;
  const stoppedMean = stopped?.mean_a ?? 0;
  let on: number;
  let gap: number | null = null;
  if (running.min_a > stoppedMax) {
    on = (stoppedMax + running.min_a) / 2;
    gap = round(running.min_a - stoppedMax, 2);
    if (gap < SMALL_GAP_A) warnings.push('The gap between stopped and running is small ({gap} A).');
  } else {
    on = (stoppedMean + running.mean_a) / 2;
    warnings.push('Running and stopped currents overlap. Check the clamp sits on one wire of the motor supply and measure again.');
  }
  on = round(Math.max(on, MIN_ON_THRESHOLD_A), 2);

  let offBelow: number | null = null;
  if (off && idle) {
    if (idle.min_a > off.max_a) {
      offBelow = round((off.max_a + idle.min_a) / 2, 2);
      if (offBelow >= on) offBelow = null;
    } else {
      warnings.push('Off and idle currents overlap: the machine will show as stopped either way.');
    }
  }
  return { on_threshold_a: on, off_below_a: offBelow, warnings, gap_a: gap };
}

/** Pulses per unit from one run, to 4 decimals; null when either side is not above zero. */
export function rotationsPerUnitFrom(pulses: number, units: number): number | null {
  if (!finite(pulses) || !finite(units) || pulses <= 0 || units <= 0) return null;
  const r = round(pulses / units, 4);
  return r > 0 ? r : 0.0001;
}

export interface CountComparison {
  /** What the current setting would have reported for the run, in units (2 decimals). */
  units_now: number;
  new_per_unit: number | null;
  /** How far the current setting is off, in percent of the units entered (1 decimal); null when unknown. */
  change_pct: number | null;
}

export function countComparison(pulses: number, unitsEntered: number, rotationsPerUnitNow: number): CountComparison {
  const now = finite(rotationsPerUnitNow) && rotationsPerUnitNow > 0 ? rotationsPerUnitNow : 1;
  const unitsNow = round((finite(pulses) ? pulses : 0) / now, 2);
  const newPerUnit = rotationsPerUnitFrom(pulses, unitsEntered);
  const changePct = newPerUnit !== null && unitsEntered > 0 ? round(((unitsNow - unitsEntered) / unitsEntered) * 100, 1) : null;
  return { units_now: unitsNow, new_per_unit: newPerUnit, change_pct: changePct };
}

export interface StepStatus {
  ready: boolean;
  have: number;
  want: number;
  /** English key for t(). */
  phrase: string;
}

/** Where a measuring step stands by how many one-minute windows have arrived. */
export function stepStatus(windowCount: number, want = 2): StepStatus {
  const have = Math.max(0, Math.floor(windowCount));
  const ready = have >= want;
  let phrase: string;
  if (ready) phrase = 'Measured.';
  else if (have === 0) phrase = 'Waiting for the first minute of readings…';
  else if (want - have === 1) phrase = 'One minute measured, one more to go…';
  else phrase = '{have} of {want} minutes measured…';
  return { ready, have, want, phrase };
}

const CHANNEL_THRESHOLDS_FROM = [2, 6, 0];

/** "2.6.0-uni" → true from 2.6.0 up (the board honours a per-channel threshold); unknown → false. */
export function firmwareHasChannelThresholds(fw: string | null | undefined): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(fw ?? ''));
  if (!m) return false;
  const v = m.slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (v[i] !== CHANNEL_THRESHOLDS_FROM[i]) return v[i] > CHANNEL_THRESHOLDS_FROM[i];
  return true;
}

/** How far a count measured over `windows` minutes can be off, in percent (one partial minute each end). */
export function countErrorPct(windows: number): number {
  return Math.round(100 / Math.max(windows, 1));
}
