import type { Tone } from '@/components/ui/simple';
import { normalizeMachineStatus } from '@/lib/utils';

/** 289 → "4 h 49 m", 45 → "45 m". */
export function humanMinutes(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} m`;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** plural(1, 'machine') → "1 machine", plural(3, 'machine') → "3 machines". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString('en-IN')} ${n === 1 ? word : many}`;
}

/** How a page names its time window: no dates in the URL means the live current shift. */
export function periodPhrase(from?: string | null, to?: string | null): string {
  return from || to ? 'selected time' : 'this shift';
}

export type MachineState = 'running' | 'stopped' | 'no_signal';

export const STATE_TONE: Record<MachineState, Tone> = {
  running: 'good',
  stopped: 'bad',
  no_signal: 'idle',
};

export const STATE_WORD: Record<MachineState, string> = {
  running: 'Running',
  stopped: 'Stopped',
  no_signal: 'No signal',
};

export function machineState(status: string | null | undefined): MachineState {
  return normalizeMachineStatus(status ?? 'no_data');
}

/** Running-time colours, same cut-offs as Alerts: under 70% red, under 85% amber. */
export const RUN_WARN_PCT = 85;
export const RUN_BAD_PCT = 70;

export function runTone(pct: number | null | undefined): Tone {
  if (pct == null) return 'idle';
  if (pct < RUN_BAD_PCT) return 'bad';
  if (pct < RUN_WARN_PCT) return 'warn';
  return 'good';
}

/** 78.4 → "78%", null → "—". Whole percents read faster on the floor. */
export function wholePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? '—' : `${Math.round(value)}%`;
}

export const QUALITY_CHECK_WORD: Record<string, string> = {
  defect_rate: 'Bad pieces',
  first_pass_yield: 'Good first time',
  scrap_rate: 'Thrown away',
  rework_rate: 'Made again',
};

export function qualityCheckWord(metric: string): string {
  return QUALITY_CHECK_WORD[metric] ?? metric.replace(/_/g, ' ');
}
