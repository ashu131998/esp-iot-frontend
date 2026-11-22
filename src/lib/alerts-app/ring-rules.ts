/**
 * When an admin's phone rings (query-api notify/ring-rules.js; the user, 2026-11-22: "option to when to
 * show alert ... for a particular admin, it is not necessary to show everytime"): ringing hours on the
 * app's clock (India time), whether a stopped machine still rings outside them, and which kinds ring.
 * An alert that does not ring still comes into the inbox. Each admin sets their own in Settings
 * (components/alerts-app/ring-rules-card.tsx); workers ring for everything. Pure: alerts-app-ring-rules.test.ts.
 */

export type RingKind = 'machine_stopped' | 'machine_running' | 'camera' | 'shift';

export const RING_KINDS: RingKind[] = ['machine_stopped', 'machine_running', 'camera', 'shift'];

export interface RingRules {
  hours: { on: boolean; from: string; to: string };
  /** A stopped machine rings outside the hours too. */
  machine_always: boolean;
  kinds: Record<RingKind, boolean>;
}

export interface RingRulesAnswer {
  /** An admin: they set their own; anyone else rings for everything. */
  allowed: boolean;
  time_zone: string;
  rules: RingRules;
}

export const RING_RULES_QUERY_KEY = ['me-ring-rules'] as const;

/** Every half hour of the day, "00:00" to "23:30": the choices for the ringing hours. */
export function timeChoices(): string[] {
  return Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
}

/** "08:00" → "8:00 am", "00:30" → "12:30 am", "22:00" → "10:00 pm" (the app's 12-hour clock). */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** The rules with one change made (what the card saves). */
export function withChange(rules: RingRules, change: { hours?: Partial<RingRules['hours']>; machine_always?: boolean; kind?: [RingKind, boolean] }): RingRules {
  return {
    hours: { ...rules.hours, ...change.hours },
    machine_always: change.machine_always ?? rules.machine_always,
    kinds: change.kind ? { ...rules.kinds, [change.kind[0]]: change.kind[1] } : { ...rules.kinds },
  };
}
