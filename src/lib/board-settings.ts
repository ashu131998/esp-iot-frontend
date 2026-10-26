/**
 * A board's settings as the super-admin edits them (Boards page): the same rules the
 * server checks before sending them to the board (query-api src/boards.js).
 */

export type SensorKind = 'current' | 'proximity' | 'ds18b20' | 'vibration';

export interface BoardChannel {
  slot: string;
  type: SensorKind;
  name: string;
  cal?: number;
  debounce_us?: number;
  rom?: string;
}

export interface BoardSettings {
  channels: BoardChannel[];
  thresholds: { on_amps: number; confirm_samples: number };
}

export const CHANNEL_SLOTS = ['I1', 'I2', 'I3', 'I4', 'P1', 'P2', 'T1', 'T2', 'V1', 'V2'] as const;

const KIND_BY_PREFIX: Record<string, SensorKind> = { I: 'current', P: 'proximity', T: 'ds18b20', V: 'vibration' };

export const KIND_LABEL: Record<SensorKind, string> = {
  current: 'Current (CT)',
  proximity: 'Proximity',
  ds18b20: 'Temperature',
  vibration: 'Vibration',
};

/** The one kind of sensor a slot takes (I = current, P = proximity, T = temperature, V = vibration). */
export function kindForSlot(slot: string): SensorKind | null {
  return KIND_BY_PREFIX[slot.charAt(0).toUpperCase()] ?? null;
}

/** REV B's own defaults: CTs on I1–I4, proximity on P1–P2. */
export function defaultBoardSettings(): BoardSettings {
  return {
    channels: [
      ...(['I1', 'I2', 'I3', 'I4'] as const).map((slot) => ({ slot, type: 'current' as const, name: slot, cal: 30 })),
      ...(['P1', 'P2'] as const).map((slot) => ({ slot, type: 'proximity' as const, name: slot })),
    ],
    thresholds: { on_amps: 0.12, confirm_samples: 5 },
  };
}

/** A channel for a slot, with its kind's defaults. */
export function newChannel(slot: string): BoardChannel {
  const type = kindForSlot(slot) ?? 'current';
  return type === 'current' ? { slot, type, name: slot, cal: 30 } : { slot, type, name: slot };
}

/** Slots not used yet, in order. */
export function freeSlots(settings: BoardSettings): string[] {
  const used = new Set(settings.channels.map((c) => c.slot));
  return CHANNEL_SLOTS.filter((s) => !used.has(s));
}

/** What is wrong with the settings, as messages (empty: good to send). */
export function settingsProblems(settings: BoardSettings): string[] {
  const problems: string[] = [];
  if (settings.channels.length === 0) problems.push('Add at least one sensor channel.');
  const seen = new Set<string>();
  for (const c of settings.channels) {
    if (seen.has(c.slot)) problems.push(`Slot ${c.slot} is used twice.`);
    seen.add(c.slot);
    if (kindForSlot(c.slot) !== c.type) problems.push(`Slot ${c.slot} takes ${KIND_LABEL[kindForSlot(c.slot) ?? 'current']}.`);
    if (c.type === 'current' && !(Number(c.cal) > 0 && Number(c.cal) <= 1000)) {
      problems.push(`${c.slot}: calibration must be between 0 and 1000.`);
    }
    if (c.type === 'ds18b20' && c.rom && !/^[0-9a-fA-F]{16}$/.test(c.rom)) {
      problems.push(`${c.slot}: sensor ROM must be 16 hex digits.`);
    }
    if (c.name.length > 23) problems.push(`${c.slot}: name can be at most 23 characters.`);
  }
  const { on_amps: onAmps, confirm_samples: confirm } = settings.thresholds;
  if (!(onAmps > 0 && onAmps <= 100)) problems.push('On threshold must be between 0 and 100 A.');
  if (!(Number.isInteger(confirm) && confirm >= 1 && confirm <= 60)) problems.push('Confirm samples must be a whole number from 1 to 60.');
  return problems;
}
