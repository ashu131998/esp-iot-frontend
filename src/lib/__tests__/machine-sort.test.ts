import { describe, expect, it } from 'vitest';

import { compareMachineNameCase, compareMachineNames, sortByMachineName } from '../machine-sort';

describe('compareMachineNames', () => {
  it('orders numeric segments naturally (2 before 10)', () => {
    expect(compareMachineNames('Loom 2', 'Loom 10')).toBeLessThan(0);
    expect(compareMachineNames('Loom 10', 'Loom 2')).toBeGreaterThan(0);
  });

  it('sorts mixed names as expected', () => {
    const names = ['Loom 10', 'Loom 2', 'Loom 1'].sort(compareMachineNames);
    expect(names).toEqual(['Loom 1', 'Loom 2', 'Loom 10']);
  });

  it('treats names as equal when only letter case differs', () => {
    expect(compareMachineNames('loom 1', 'Loom 1')).toBe(0);
  });
});

describe('compareMachineNameCase', () => {
  it('puts Loom before loom when group key matches (not ASCII order)', () => {
    expect(compareMachineNames('Loom 1', 'loom 1')).toBe(0);
    expect(compareMachineNameCase('Loom 1', 'loom 1')).toBeLessThan(0);
    expect(compareMachineNameCase('loom 1', 'Loom 1')).toBeGreaterThan(0);
  });
});

describe('sortByMachineName', () => {
  it('uses machine_name when name is absent', () => {
    const rows = sortByMachineName([
      { machine_id: 'a', machine_name: 'Loom 10' },
      { machine_id: 'b', machine_name: 'Loom 2' },
    ]);
    expect(rows.map((r) => r.machine_id)).toEqual(['b', 'a']);
  });

  it('orders Loom before loom for the same name', () => {
    const rows = sortByMachineName([
      { machine_id: 'b', name: 'loom 3' },
      { machine_id: 'a', name: 'Loom 3' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Loom 3', 'loom 3']);
  });

  it('keeps case variants consecutive (never separated by other names)', () => {
    const rows = sortByMachineName([
      { machine_id: '1', name: 'loom 1' },
      { machine_id: '2', name: 'Alpha' },
      { machine_id: '3', name: 'Loom 1' },
      { machine_id: '4', name: 'Loom 2' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Loom 1', 'loom 1', 'Loom 2']);
  });
});
