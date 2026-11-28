/**
 * A device's sensors as ONE list, the same in the staff console's Boards and Nodes pages and in a factory's
 * Sensor mapping (the owner, 2026-11-27: "all three places should be consistent", the Boards page's way;
 * "add sensor row, save mapping ... should work very precisely", "reliable"). The server joins the board's
 * channels and their machine links into these rows (query-api board-sensors.js) and saves them in one
 * transaction; the checks here are the server's, so a problem shows on its row before anything is sent.
 */

export type ChannelKind = 'current' | 'proximity' | 'ds18b20' | 'vibration';

/** One sensor: a channel of the board (`board`) with its machine link, or a link of its own (a Modbus sensor, a node's own channel). */
export interface SensorRow {
  slot: string;
  /** What its readings are linked as: current, cycle (a board's P1/P2), temperature, vibration, proximity, time. */
  sensor_type: string;
  board: boolean;
  name: string;
  machine_id: string | null;
  on_threshold_a: number | null;
  enabled: boolean;
  /** A current channel's CT calibration, a proximity input's debounce (µs), a temperature probe's ROM: on the board. */
  cal?: number;
  debounce_us?: number;
  rom?: string;
  binding_id?: string | null;
}

export interface SensorsBoard {
  board_id: string;
  /** Its channels were set from the dashboard (else it runs its own and is set up when claimed). */
  managed: boolean;
  thresholds: { on_amps: number; confirm_samples: number };
  firmware: string | null;
}

export interface SensorsDetail {
  rows: SensorRow[];
  version: string;
  board: SensorsBoard | null;
}

export interface SensorProblem {
  /** The row it is about; null: the whole board. */
  row: number | null;
  message: string;
}

export const BOARD_SLOTS = ['I1', 'I2', 'I3', 'I4', 'P1', 'P2', 'T1', 'T2', 'V1', 'V2'] as const;
export const MODBUS_SLOTS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'] as const;
export const NAME_MAX = 60;
/** The board keeps the first 23 characters of a name. */
export const BOARD_NAME_MAX = 23;
export const MAX_ROWS = 40;

const KIND_BY_PREFIX: Record<string, ChannelKind> = { I: 'current', P: 'proximity', T: 'ds18b20', V: 'vibration' };
const LINK_TYPE_BY_KIND: Record<ChannelKind, string> = { current: 'current', proximity: 'cycle', ds18b20: 'temperature', vibration: 'vibration' };

/** A board slot in its own spelling ("i1" → "I1"); null for anything else. */
export function boardSlot(slot: string | null | undefined): string | null {
  const s = String(slot ?? '').trim().toUpperCase();
  return (BOARD_SLOTS as readonly string[]).includes(s) ? s : null;
}

export function kindForSlot(slot: string): ChannelKind | null {
  const s = boardSlot(slot);
  return s ? KIND_BY_PREFIX[s[0]] : null;
}

/** How a board slot's readings are linked ("P1" → "cycle": production counts a proximity input's pulses as cycles). */
export function linkTypeForSlot(slot: string): string | null {
  const kind = kindForSlot(slot);
  return kind ? LINK_TYPE_BY_KIND[kind] : null;
}

/** What a row measures, in words (the Boards page's names for a board's slots). */
export function sensorLabel(row: Pick<SensorRow, 'slot' | 'sensor_type' | 'board'>): string {
  const kind = row.board ? kindForSlot(row.slot) : null;
  if (kind === 'current') return 'Current (CT)';
  if (kind === 'proximity') return 'Proximity (count)';
  if (kind === 'ds18b20') return 'Temperature';
  if (kind === 'vibration') return 'Vibration';
  return ({
    current: 'Current', cycle: 'Count (cycles)', proximity: 'Proximity', temperature: 'Temperature', vibration: 'Vibration', time: 'Time',
  } as Record<string, string>)[row.sensor_type] ?? row.sensor_type;
}

/** What "Add a sensor" offers: the board's free slots (who may change the board), Modbus sensors, channels seen on the wire. */
export interface AddChoice {
  key: string;
  label: string;
  row: SensorRow;
}

export function addChoices({
  rows, board, canHardware, discovered,
}: {
  rows: SensorRow[];
  board: SensorsBoard | null;
  canHardware: boolean;
  discovered: Array<{ channel_slot: string; sensor_type: string; sample_name?: string | null }>;
}): AddChoice[] {
  // one row per board slot, whatever it is linked as; any other channel, one per type (as sensorProblems counts them)
  const keyOf = (slot: string, type: string) => boardSlot(slot) ?? `${slot.trim()}|${type}`;
  const taken = new Set(rows.map((r) => keyOf(r.slot, r.sensor_type)));
  const has = (slot: string, type: string) => taken.has(keyOf(slot, type));
  const out: AddChoice[] = [];
  const offer = (choice: AddChoice) => {
    taken.add(keyOf(choice.row.slot, choice.row.sensor_type));
    out.push(choice);
  };
  const blank = (slot: string, sensorType: string, onBoard: boolean): SensorRow => ({
    slot, sensor_type: sensorType, board: onBoard, name: slot, machine_id: null,
    on_threshold_a: sensorType === 'current' ? (board?.thresholds.on_amps ?? null) : null, enabled: true,
    ...(onBoard && kindForSlot(slot) === 'current' ? { cal: 30 } : {}),
  });
  // the board's own slots: on a board set from the dashboard, a channel of it (our super admin); elsewhere a link
  const boardChannels = Boolean(board?.managed);
  if (!board || (boardChannels && canHardware)) {
    for (const slot of BOARD_SLOTS) {
      const type = linkTypeForSlot(slot)!;
      if (has(slot, type)) continue;
      offer({ key: `board:${slot}`, label: `${slot} · ${sensorLabel({ slot, sensor_type: type, board: true })}`, row: blank(slot, type, boardChannels) });
    }
  }
  for (const slot of MODBUS_SLOTS) {
    for (const type of ['temperature', 'vibration']) {
      if (has(slot, type)) continue;
      offer({ key: `modbus:${slot}:${type}`, label: `${slot} · Modbus ${type}`, row: blank(slot, type, false) });
    }
  }
  for (const ch of discovered) {
    const slot = boardSlot(ch.channel_slot) ?? ch.channel_slot.trim();
    const type = linkTypeForSlot(slot) ?? ch.sensor_type;
    if (has(slot, type)) continue;
    if (boardSlot(slot) && board) continue;   // one of our boards' own slots: its channel, added above (or not here)
    offer({
      key: `seen:${slot}:${type}`,
      label: `${slot || 'Single channel'} · ${sensorLabel({ slot, sensor_type: type, board: false })} (seen on the wire${ch.sample_name ? `: ${ch.sample_name}` : ''})`,
      row: { ...blank(slot, type, false), name: ch.sample_name || slot || 'Sensor' },
    });
  }
  return out;
}

/** The checks the server makes on a save (query-api board-sensors.js planSensorSave), row by row. */
export function sensorProblems(rows: SensorRow[], machineIds: ReadonlySet<string>): SensorProblem[] {
  const problems: SensorProblem[] = [];
  if (rows.length > MAX_ROWS) return [{ row: null, message: `At most ${MAX_ROWS} sensors on one device` }];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const bslot = boardSlot(r.slot);
    const slot = bslot ?? r.slot.trim();
    const called = slot || 'The single channel';
    const own = bslot ? linkTypeForSlot(bslot) : null;
    const type = r.board ? own : r.sensor_type;
    if (own && type !== own && !(own === 'cycle' && type === 'proximity')) {
      problems.push({ row: i, message: `${called} takes ${own} only` });
      return;
    }
    const key = bslot ?? `${slot}|${type}`;
    if (seen.has(key)) {
      problems.push({ row: i, message: `${called} is listed twice` });
      return;
    }
    seen.add(key);
    if (r.name.trim().length > NAME_MAX) problems.push({ row: i, message: `${called}: the name can be at most ${NAME_MAX} characters` });
    if (r.machine_id && !machineIds.has(r.machine_id)) problems.push({ row: i, message: `${called}: that machine is not in this factory (any more)` });
    if (!r.machine_id && !r.board) problems.push({ row: i, message: `${called}: pick its machine, or remove the row` });
    if (type === 'current' && r.on_threshold_a !== null && r.on_threshold_a !== undefined) {
      const n = Number(r.on_threshold_a);
      if (!(Number.isFinite(n) && n > 0 && n <= 100)) problems.push({ row: i, message: `${called}: the on threshold must be more than 0 and at most 100 A` });
    }
    if (r.board && kindForSlot(slot) === 'current' && r.cal !== undefined && !(Number(r.cal) > 0 && Number(r.cal) <= 1000)) {
      problems.push({ row: i, message: `${called}: calibration must be between 0 and 1000` });
    }
    if (r.board && r.rom && !/^[0-9a-fA-F]{16}$/.test(r.rom)) problems.push({ row: i, message: `${called}: the sensor ROM must be 16 hex digits` });
    if (r.board && r.debounce_us !== undefined && !(Number.isInteger(Number(r.debounce_us)) && Number(r.debounce_us) >= 0 && Number(r.debounce_us) <= 1_000_000)) {
      problems.push({ row: i, message: `${called}: debounce must be 0–1,000,000 µs` });
    }
  });
  return problems;
}

/** The board-wide thresholds' own checks (our super admin's). */
export function thresholdProblems(t: { on_amps: number; confirm_samples: number }): string[] {
  const out: string[] = [];
  if (!(t.on_amps > 0 && t.on_amps <= 100)) out.push('On threshold must be between 0 and 100 A.');
  if (!(Number.isInteger(t.confirm_samples) && t.confirm_samples >= 1 && t.confirm_samples <= 60)) out.push('Confirm samples must be a whole number from 1 to 60.');
  return out;
}

/** What a save sends: the rows as the editor holds them (link ids are the server's to keep). */
export function saveBody(version: string, rows: SensorRow[], thresholds: SensorsBoard['thresholds'] | null) {
  return {
    version,
    // without the link ids (undefined: left out of the JSON)
    rows: rows.map((r) => ({ ...r, binding_id: undefined, name: r.name.trim() })),
    ...(thresholds ? { thresholds } : {}),
  };
}
