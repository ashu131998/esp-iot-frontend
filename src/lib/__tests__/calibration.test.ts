import { describe, expect, it } from 'vitest';

import {
  countComparison,
  countErrorPct,
  firmwareHasChannelThresholds,
  proposeThresholds,
  rotationsPerUnitFrom,
  stepStatus,
  summarizeWindows,
} from '@/lib/calibration';

const off = { windows: 2, mean_a: 0.05, min_a: 0, max_a: 0.12 };
const idle = { windows: 2, mean_a: 0.9, min_a: 0.7, max_a: 1.1 };
const running = { windows: 3, mean_a: 4.2, min_a: 3.6, max_a: 5.0 };

describe('summarizeWindows', () => {
  it('means the averages and takes the extremes', () => {
    expect(summarizeWindows([
      { occurred_at: 'a', amps: 4.0, amps_min: 3.6, amps_max: 4.4 },
      { occurred_at: 'b', amps: 4.4, amps_min: 3.9, amps_max: 5.0 },
    ])).toEqual({ windows: 2, mean_a: 4.2, min_a: 3.6, max_a: 5 });
  });
  it('skips windows without a reading, falls back to the average for missing extremes', () => {
    expect(summarizeWindows([{ occurred_at: 'a', amps: null, amps_min: null, amps_max: null }, { occurred_at: 'b', amps: 1, amps_min: null, amps_max: null }]))
      .toEqual({ windows: 1, mean_a: 1, min_a: 1, max_a: 1 });
    expect(summarizeWindows([])).toBe(null);
    expect(summarizeWindows(null)).toBe(null);
  });
});

describe('proposeThresholds', () => {
  it('halfway between idle high and running low, and between off high and idle low', () => {
    expect(proposeThresholds({ off, idle, running })).toEqual({ on_threshold_a: 2.35, off_below_a: 0.41, warnings: [], gap_a: 2.5 });
  });
  it('without idle, the off level is the stopped side and there is no off threshold', () => {
    expect(proposeThresholds({ off, idle: null, running })).toEqual({ on_threshold_a: 1.86, off_below_a: null, warnings: [], gap_a: 3.48 });
  });
  it('without any stopped level, the stopped side is zero', () => {
    expect(proposeThresholds({ off: null, idle: null, running })).toMatchObject({ on_threshold_a: 1.8, off_below_a: null, warnings: [] });
  });
  it('needs the running level', () => {
    expect(proposeThresholds({ off, idle, running: null })).toEqual({ on_threshold_a: null, off_below_a: null, warnings: ['Measure the loom running first.'], gap_a: null });
  });
  it('falls back to the means and warns when running and stopped overlap', () => {
    const overlapping = { windows: 2, mean_a: 1.4, min_a: 0.8, max_a: 2.0 };   // low dips below idle's high
    const out = proposeThresholds({ off, idle, running: overlapping });
    expect(out.on_threshold_a).toBe(1.15);   // (0.9 + 1.4) / 2
    expect(out.warnings).toEqual(['Running and stopped currents overlap. Check the clamp sits on one wire of the motor supply and measure again.']);
  });
  it('warns about a small gap', () => {
    const close = { windows: 2, mean_a: 1.3, min_a: 1.15, max_a: 1.5 };   // 0.05 A above idle's 1.1
    const out = proposeThresholds({ off, idle, running: close });
    expect(out.on_threshold_a).toBe(1.13);
    expect(out.gap_a).toBe(0.05);
    expect(out.warnings).toEqual(['The gap between stopped and running is small ({gap} A).']);
  });
  it('warns when off and idle overlap and gives no off threshold', () => {
    const noisyOff = { windows: 2, mean_a: 0.5, min_a: 0.1, max_a: 0.8 };
    const out = proposeThresholds({ off: noisyOff, idle, running });
    expect(out.off_below_a).toBe(null);
    expect(out.warnings).toEqual(['Off and idle currents overlap: the loom will show as stopped either way.']);
  });
  it('never goes below the minimum on threshold', () => {
    const tiny = { windows: 1, mean_a: 0.03, min_a: 0.02, max_a: 0.04 };
    expect(proposeThresholds({ off: null, idle: null, running: tiny }).on_threshold_a).toBe(0.05);
  });
});

describe('rotationsPerUnitFrom / countComparison', () => {
  it('divides pulses by units', () => {
    expect(rotationsPerUnitFrom(1200, 48)).toBe(25);
    expect(rotationsPerUnitFrom(10, 40)).toBe(0.25);
    expect(rotationsPerUnitFrom(0, 48)).toBe(null);
    expect(rotationsPerUnitFrom(1200, 0)).toBe(null);
  });
  it('compares with the current setting', () => {
    expect(countComparison(1200, 48, 20)).toEqual({ units_now: 60, new_per_unit: 25, change_pct: 25 });
    expect(countComparison(1200, 60, 20)).toEqual({ units_now: 60, new_per_unit: 20, change_pct: 0 });
    expect(countComparison(1200, 0, 20)).toEqual({ units_now: 60, new_per_unit: null, change_pct: null });
    expect(countComparison(1200, 48, 0).units_now).toBe(1200);   // a setting of 0 counts as 1
  });
});

describe('stepStatus', () => {
  it('counts the minutes towards two', () => {
    expect(stepStatus(0)).toEqual({ ready: false, have: 0, want: 2, phrase: 'Waiting for the first minute of readings…' });
    expect(stepStatus(1)).toEqual({ ready: false, have: 1, want: 2, phrase: 'One minute measured, one more to go…' });
    expect(stepStatus(2)).toEqual({ ready: true, have: 2, want: 2, phrase: 'Measured.' });
    expect(stepStatus(5)).toMatchObject({ ready: true, have: 5 });
    expect(stepStatus(1, 3)).toMatchObject({ ready: false, phrase: '{have} of {want} minutes measured…' });
  });
});

describe('firmwareHasChannelThresholds / countErrorPct', () => {
  it('knows which firmware takes a threshold per channel', () => {
    expect(firmwareHasChannelThresholds('2.5.0-uni')).toBe(false);
    expect(firmwareHasChannelThresholds('2.6.0-uni')).toBe(true);
    expect(firmwareHasChannelThresholds('2.10.1')).toBe(true);
    expect(firmwareHasChannelThresholds(null)).toBe(false);
  });
  it('a count over few minutes can be off by a minute each end', () => {
    expect(countErrorPct(10)).toBe(10);
    expect(countErrorPct(3)).toBe(33);
    expect(countErrorPct(0)).toBe(100);
  });
});
