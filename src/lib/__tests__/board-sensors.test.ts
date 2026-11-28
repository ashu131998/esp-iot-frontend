import { describe, expect, it } from 'vitest';

import {
  addChoices, boardSlot, kindForSlot, linkTypeForSlot, saveBody, sensorLabel, sensorProblems, thresholdProblems,
  type SensorRow, type SensorsBoard,
} from '@/lib/board-sensors';

/**
 * A device's sensors as one list, the same in the Boards page, the Nodes page and the factory's Sensor mapping
 * (2026-11-27): the editor's own checks are the server's (query-api board-sensors.js), so a problem shows on its
 * row before anything is sent; what "Add a sensor" offers depends on the device and on who is editing.
 */
const row = (slot: string, sensor_type: string, board: boolean, extra: Partial<SensorRow> = {}): SensorRow => ({
  slot, sensor_type, board, name: slot, machine_id: null, on_threshold_a: null, enabled: true, ...extra,
});
const MANAGED: SensorsBoard = { board_id: 'revb-1', managed: true, thresholds: { on_amps: 0.12, confirm_samples: 5 }, firmware: '2.9.4' };
const MACHINES = new Set(['m1', 'm2']);

describe('slots', () => {
  it('a board slot in its own spelling, its one kind, and what its readings are linked as', () => {
    expect(boardSlot(' p1 ')).toBe('P1');
    expect(boardSlot('M1')).toBeNull();
    expect(kindForSlot('T2')).toBe('ds18b20');
    expect(linkTypeForSlot('P2')).toBe('cycle');   // production counts a proximity input's pulses as cycles
    expect(linkTypeForSlot('V1')).toBe('vibration');
  });

  it('what a row measures, in words: a board\'s slot by its kind, anything else by its link', () => {
    expect(sensorLabel(row('I1', 'current', true))).toBe('Current (CT)');
    expect(sensorLabel(row('P1', 'cycle', true))).toBe('Proximity (count)');
    expect(sensorLabel(row('M1', 'vibration', false))).toBe('Vibration');
    expect(sensorLabel(row('CY', 'cycle', false))).toBe('Count (cycles)');
  });
});

describe('the problems, row by row (as the server finds them)', () => {
  it('none for a good list: a board channel needs no machine, anything else does', () => {
    expect(sensorProblems([row('I1', 'current', true), row('M1', 'vibration', false, { machine_id: 'm1' })], MACHINES)).toEqual([]);
  });

  it('each with its row', () => {
    const rows = [
      row('I1', 'current', true, { on_threshold_a: 0 }),
      row('M1', 'vibration', false),                                     // no machine
      row('M1', 'vibration', false, { machine_id: 'm1' }),                // twice
      row('M2', 'temperature', false, { machine_id: 'gone', name: 'x'.repeat(61) }),
      row('P2', 'current', false, { machine_id: 'm1' }),                  // a P slot is a count
      row('I2', 'current', true, { cal: 0 }),
      row('T1', 'temperature', true, { rom: 'nothex' }),
    ];
    expect(sensorProblems(rows, MACHINES)).toEqual([
      { row: 0, message: 'I1: the on threshold must be more than 0 and at most 100 A' },
      { row: 1, message: 'M1: pick its machine, or remove the row' },
      { row: 2, message: 'M1 is listed twice' },
      { row: 3, message: 'M2: the name can be at most 60 characters' },
      { row: 3, message: 'M2: that machine is not in this factory (any more)' },
      { row: 4, message: 'P2 takes cycle only' },
      { row: 5, message: 'I2: calibration must be between 0 and 1000' },
      { row: 6, message: 'T1: the sensor ROM must be 16 hex digits' },
    ]);
  });

  it('a board slot is one sensor whatever it is linked as; an older "proximity" link on a P slot is allowed', () => {
    expect(sensorProblems([row('P1', 'cycle', true), row('p1', 'proximity', false, { machine_id: 'm1' })], MACHINES))
      .toEqual([{ row: 1, message: 'P1 is listed twice' }]);
    expect(sensorProblems([row('P1', 'proximity', false, { machine_id: 'm1' })], MACHINES)).toEqual([]);
  });

  it('the board-wide thresholds', () => {
    expect(thresholdProblems({ on_amps: 0.12, confirm_samples: 5 })).toEqual([]);
    expect(thresholdProblems({ on_amps: 0, confirm_samples: 61 })).toHaveLength(2);
  });
});

describe('"Add a sensor"', () => {
  const keys = (choices: ReturnType<typeof addChoices>) => choices.map((c) => c.key);

  it('our super admin on a board set from the dashboard: its free slots as channels of the board, then Modbus sensors', () => {
    const choices = addChoices({ rows: [row('I1', 'current', true), row('P1', 'cycle', true)], board: MANAGED, canHardware: true, discovered: [] });
    expect(keys(choices).slice(0, 8)).toEqual(['board:I2', 'board:I3', 'board:I4', 'board:P2', 'board:T1', 'board:T2', 'board:V1', 'board:V2']);
    const i2 = choices.find((c) => c.key === 'board:I2')!.row;
    expect(i2).toMatchObject({ slot: 'I2', sensor_type: 'current', board: true, cal: 30, on_threshold_a: 0.12, machine_id: null });
    expect(choices.find((c) => c.key === 'board:P2')!.row.sensor_type).toBe('cycle');
    expect(keys(choices)).toContain('modbus:M1:vibration');
  });

  it('anyone else on a board: no channels of the board (that is our super admin\'s), Modbus sensors only', () => {
    const choices = addChoices({ rows: [row('I1', 'current', true)], board: MANAGED, canHardware: false, discovered: [{ channel_slot: 'I2', sensor_type: 'current' }] });
    expect(keys(choices).some((k) => k.startsWith('board:') || k.startsWith('seen:'))).toBe(false);
    expect(keys(choices)).toContain('modbus:M8:temperature');
  });

  it('a node that is not one of our boards: board-style links, Modbus, and what was seen on the wire; nothing listed twice', () => {
    const choices = addChoices({
      rows: [row('', 'current', false, { machine_id: 'm1' }), row('M1', 'vibration', false, { machine_id: 'm1' })],
      board: null, canHardware: false,
      discovered: [{ channel_slot: '', sensor_type: 'current' }, { channel_slot: 'CY', sensor_type: 'cycle', sample_name: 'loom' }, { channel_slot: 'I1', sensor_type: 'current' }],
    });
    expect(choices.find((c) => c.key === 'board:I1')!.row.board).toBe(false);
    expect(keys(choices)).not.toContain('modbus:M1:vibration');   // listed already
    expect(keys(choices)).toContain('modbus:M1:temperature');      // another type on the same slot
    expect(keys(choices)).toContain('seen:CY:cycle');
    expect(choices.find((c) => c.key === 'seen:CY:cycle')!.row.name).toBe('loom');
    expect(keys(choices).filter((k) => k.endsWith(':I1') || k.startsWith('seen:I1'))).toEqual(['board:I1']);   // once
    expect(keys(choices).some((k) => k.startsWith('seen::'))).toBe(false);   // the single channel is listed already
  });
});

describe('what a save sends', () => {
  it('the rows without link ids (the server keeps those), names trimmed; the thresholds only when given', () => {
    const body = saveBody('v1', [row('I1', 'current', true, { name: '  Loom 1  ', binding_id: 'sb-1', machine_id: 'm1' })], null);
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      version: 'v1',
      rows: [{ slot: 'I1', sensor_type: 'current', board: true, name: 'Loom 1', machine_id: 'm1', on_threshold_a: null, enabled: true }],
    });
    expect(saveBody('v1', [], MANAGED.thresholds).thresholds).toEqual(MANAGED.thresholds);
  });
});
