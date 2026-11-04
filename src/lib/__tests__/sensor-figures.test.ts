import { describe, expect, it } from 'vitest';

import { SLICE_COLORS } from '@/components/charts/donut-chart';
import { CLASS_LIMITS, classSlices, highestFirst, machineRows, summaryWords, trendLines } from '@/lib/sensor-figures';
import type { SensorFiguresResponse } from '@/lib/types';

const t = (key: string, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), key);
const tn = (n: number, one: string, other: string, vars?: Record<string, string | number>) => t(n === 1 ? one : other, vars);

const figure = (key: string, latest: number | null, series: [string, number][] = [], extra = {}) => ({
  key, latest, latest_at: latest === null ? null : '2026-11-04T10:00:00.000Z', avg: latest, min: latest, max: latest, samples: series.length, series, ...extra,
});

const temperature: SensorFiguresResponse = {
  factory_id: 'mill-01', kind: 'temperature', from: 'a', to: 'b', source: 'minute', bucket_s: 60,
  machines: [
    {
      machine_id: 'm1', machine_name: 'Mixer 1', line_id: 'line-1', status: 'ok', value: 83, band: 'hot',
      sensors: [
        { device_id: 'n', slot: 'T1', label: 'Motor', figures: [figure('celsius', 83, [['2026-11-04T09:00:00.000Z', 70], ['2026-11-04T10:00:00.000Z', 83]], { min: 60, max: 83, avg: 76.5, samples: 2 })] },
        { device_id: 'n', slot: 'T2', label: 'Bearing', figures: [figure('celsius', 45, [['2026-11-04T09:00:00.000Z', 44]], { min: 40, max: 45, avg: 44, samples: 1 }), figure('humidity', 55)] },
      ],
    },
    { machine_id: 'm2', machine_name: 'Press 2', line_id: 'line-2', status: 'no_data', value: null, band: null, sensors: [{ device_id: 'n', slot: 'M1', label: 'x', figures: [] }] },
    { machine_id: 'm3', machine_name: 'Press 3', line_id: 'line-2', status: 'no_sensor', value: null, band: null, sensors: [] },
  ],
  unbound: [],
  summary: { machines: 3, with_sensor: 2, reporting: 1, bands: { normal: 0, warm: 0, hot: 1, unknown: 1 } },
};

describe('machineRows', () => {
  it('one row per machine over all its sensors: the server\'s value, the lowest low, highest high, weighted average', () => {
    const rows = machineRows(temperature);
    expect(rows[0]).toEqual({
      machine_id: 'm1', machine_name: 'Mixer 1', line_id: 'line-1', status: 'ok', value: 83, cls: 'hot',
      min: 40, max: 83, avg: 65.67, latest_at: '2026-11-04T10:00:00.000Z', sensors: 2,
    });
    expect(rows[1]).toMatchObject({ status: 'no_data', value: null, cls: 'unknown', min: null, max: null, avg: null, latest_at: null, sensors: 1 });
    expect(rows[2]).toMatchObject({ status: 'no_sensor', cls: 'unknown', sensors: 0 });
    expect(highestFirst(rows).map((r) => r.machine_id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('vibration rows use the velocity axes, not the sensor\'s own temperature', () => {
    const rows = machineRows({
      kind: 'vibration',
      machines: [{
        machine_id: 'v1', machine_name: 'Fan', line_id: 'l', status: 'ok', value: 3.5, zone: 'warning',
        sensors: [{ device_id: 'n', slot: 'M1', figures: [figure('vel_x', 1.2, [], { min: 1, max: 1.5, avg: 1.2, samples: 3 }), figure('vel_y', 3.5, [], { min: 2, max: 3.5, avg: 2.5, samples: 3 }), figure('celsius', 60, [], { min: 59, max: 61, avg: 60, samples: 3 })] }],
      }],
    });
    expect(rows[0]).toMatchObject({ value: 3.5, cls: 'warning', min: 1, max: 3.5, avg: 1.85 });
  });
});

describe('the trend and the pie', () => {
  it('one line per machine, its strongest stream, highest first, series as [ms, value]', () => {
    expect(trendLines(temperature)).toEqual([
      { name: 'Mixer 1', data: [[Date.parse('2026-11-04T09:00:00.000Z'), 70], [Date.parse('2026-11-04T10:00:00.000Z'), 83]] },
    ]);
    expect(trendLines(temperature, 0)).toEqual([]);
  });

  it('the pie counts the classes in order, with their colours', () => {
    expect(classSlices(temperature, t)).toEqual([
      { label: 'Normal', value: 0, color: SLICE_COLORS.good },
      { label: 'Warm', value: 0, color: SLICE_COLORS.warn },
      { label: 'Hot', value: 1, color: SLICE_COLORS.bad },
      { label: 'No reading', value: 1, color: SLICE_COLORS.idle },
    ]);
    expect(classSlices({ kind: 'vibration', summary: { machines: 2, with_sensor: 2, reporting: 2, zones: { good: 1, warning: 1, alarm: 0, unknown: 0 } } }, t).map((s) => [s.label, s.value]))
      .toEqual([['Good', 1], ['Warning', 1], ['Alarm', 0], ['No reading', 0]]);
    expect(CLASS_LIMITS).toEqual({ temperature: { warn: 60, bad: 80 }, vibration: { warn: 2.8, bad: 4.5 } });
  });
});

describe('summaryWords', () => {
  const summary = (kind: 'temperature' | 'vibration', s: Partial<SensorFiguresResponse['summary']>) =>
    summaryWords({ kind, summary: { machines: 4, with_sensor: 3, reporting: 3, ...s } }, t, tn);

  it('says what matters most: hot, else warm, else all well; no sensors; no readings', () => {
    expect(summary('temperature', { bands: { normal: 1, warm: 1, hot: 1, unknown: 0 } })).toEqual({ tone: 'bad', title: '1 machine runs hot', subtitle: '3 of 3 machines with a sensor are reporting' });
    expect(summary('temperature', { bands: { normal: 1, warm: 2, hot: 0, unknown: 0 } }).title).toBe('2 machines run warm');
    expect(summary('temperature', { bands: { normal: 3, warm: 0, hot: 0, unknown: 0 } })).toMatchObject({ tone: 'good', title: 'Every machine runs at a normal temperature' });
    expect(summary('vibration', { zones: { good: 0, warning: 0, alarm: 2, unknown: 0 } }).title).toBe('2 machines vibrate in the alarm zone');
    expect(summary('vibration', { zones: { good: 2, warning: 1, alarm: 0, unknown: 0 } }).title).toBe('1 machine vibrates in the warning zone');
    expect(summary('vibration', { zones: { good: 3, warning: 0, alarm: 0, unknown: 0 } }).title).toBe('Every machine vibrates in the good zone');
    expect(summary('temperature', { with_sensor: 0, reporting: 0 })).toMatchObject({ tone: 'idle', title: 'No machine has a temperature sensor yet' });
    expect(summary('vibration', { reporting: 0 })).toEqual({ tone: 'idle', title: 'No readings in this period', subtitle: '3 of 4 machines have a sensor' });
  });
});
