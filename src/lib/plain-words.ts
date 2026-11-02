import type { Tone } from '@/components/ui/simple';
import { englishTranslator, type Translate } from '@/lib/i18n/translate';
import { normalizeMachineStatus } from '@/lib/utils';

/** 289 → "4 h 49 m", 45 → "45 m"; in Hindi "4 घं 49 मि" with the page's translator. */
export function humanMinutes(min: number, t: Translate = englishTranslator.t): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t('{m} m', { m });
  return m === 0 ? t('{h} h', { h }) : t('{h} h {m} m', { h, m });
}

/**
 * plural(1, 'machine') → "1 machine", plural(3, 'machine') → "3 machines" (English only; in a
 * component use tn(n, '{count} machine', '{count} machines') so Hindi gets its own words).
 */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString('en-IN')} ${n === 1 ? word : many}`;
}

/** How a page names its time window: no dates in the URL means the live current shift. Translate with t(). */
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

/**
 * A machine's share of the window spent running, as its Status Timeline card says it ("92% running");
 * nothing at all when it did not run or there is no data (beside "No signal" a "— running" or
 * "0% running" only confuses). Pass the page's translator for Hindi.
 */
export function runningShare(value: number | null | undefined, t: Translate = englishTranslator.t): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const pct = Math.round(value);
  return pct > 0 ? t('{pct}% running', { pct: String(pct) }) : null;
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
