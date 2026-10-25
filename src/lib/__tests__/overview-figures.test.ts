import { describe, expect, it } from 'vitest';

import { overviewFigures, unitsMade } from '@/lib/overview-figures';

describe('unitsMade', () => {
  it('is the count when one arrived, a counted 0 included', () => {
    expect(unitsMade({ units_produced: 540, status: 'computed' })).toBe(540);
    expect(unitsMade({ units_produced: 0, status: 'computed' })).toBe(0);
  });
  it('is unknown without a production sensor or a count, never 0', () => {
    expect(unitsMade({ units_produced: 0, status: 'no_sensor' })).toBeNull();
    expect(unitsMade({ units_produced: 0, status: 'no_data' })).toBeNull();
    expect(unitsMade(undefined)).toBeNull();
  });
});

describe('overviewFigures (each tile by its own page\'s rule)', () => {
  const none = { availability: [], production: [], energy: [], performance: [] };

  it('running time leaves machines with no data out, as the Availability page does', () => {
    // 50 % and 80 % known, one machine silent: 65 %, not 43.3 %
    const f = overviewFigures({ ...none, availability: [{ availability_percent: 50 }, { availability_percent: 80 }, { availability_percent: null }] });
    expect(f.runningPercent).toBe(65);
  });

  it('on target is the Performance page\'s figure, not availability × (units ÷ target × whole window)', () => {
    // The Performance page: loom A ran half the time at full speed = 50 %; loom B has no target (unknown).
    // The old overview formula gave 50 % × 50 % = 25 % for loom A.
    const f = overviewFigures({ ...none, performance: [{ performance_percent: 50 }, { performance_percent: null }] });
    expect(f.onTargetPercent).toBe(50);
    expect(overviewFigures(none).onTargetPercent).toBeNull();
  });

  it('made counts what arrived; nothing counted is unknown, not 0', () => {
    const f = overviewFigures({
      ...none,
      production: [
        { units_produced: 540, status: 'computed', unit_label: 'm' },
        { units_produced: 12.5, status: 'computed', unit_label: 'm' },
        { units_produced: 0, status: 'no_sensor', unit_label: null },
      ],
    });
    expect([f.units, f.unitLabel]).toEqual([552.5, 'm']);
    expect(overviewFigures({ ...none, production: [{ units_produced: 0, status: 'no_sensor', unit_label: null }] }).units).toBeNull();
  });

  it('power used sums the known energy; none known is unknown, not 0 kWh', () => {
    expect(overviewFigures({ ...none, energy: [{ energy_kwh: 2.3 }, { energy_kwh: null }, { energy_kwh: 1.006 }] }).kwh).toBe(3.31);
    expect(overviewFigures({ ...none, energy: [{ energy_kwh: null }] }).kwh).toBeNull();
  });
});
