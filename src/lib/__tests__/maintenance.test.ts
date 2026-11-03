import { describe, expect, it } from 'vitest';

import { SLICE_COLORS } from '@/components/charts/donut-chart';
import { conditionInfo, conditionSlices, nextServiceWords, overviewWords, signText, signTone } from '@/lib/maintenance';
import type { MaintenanceSign } from '@/lib/types';

const t = (key: string, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), key);
const tn = (n: number, one: string, other: string, vars?: Record<string, string | number>) => t(n === 1 ? one : other, vars);
const sign = (kind: MaintenanceSign['kind'], severity: MaintenanceSign['severity'], codes: string[], value: number | null, baseline: number | null = null, change: number | null = null): MaintenanceSign =>
  ({ kind, severity, codes, value, baseline, change_pct: change });

describe('what a sign says', () => {
  it('vibration, temperature, load, stops, service', () => {
    expect(signText(sign('vibration', 3, ['vibration_alarm', 'vibration_rising'], 5.2, 3, 73), t)).toBe('Vibration 5.2 mm/s, alarm zone · up +73% this week');
    expect(signText(sign('vibration', 0, ['vibration_good'], 1, 1, 0), t)).toBe('Vibration 1 mm/s, good zone');
    expect(signText(sign('temperature', 3, ['temperature_hot', 'temperature_rising'], 84.4, 70), t)).toBe('Temperature 84.4 °C, hot · up 14.4 °C today');
    expect(signText(sign('temperature', 1, ['temperature_warm'], 66), t)).toBe('Temperature 66 °C, warm');
    expect(signText(sign('load', 2, ['load_up'], 6.5, 5, 30), t)).toBe('Motor load +30% against its first month (6.5 A, was 5 A)');
    expect(signText(sign('load', 0, ['load_steady'], 5), t)).toBe('Motor load steady at 5 A');
    expect(signText(sign('stops', 2, ['stops_up'], 5, 1, 400), t)).toBe('5 stops a day, was 1');
    expect(signText(sign('stops', 0, ['stops_steady'], 0.4, 0.5), t)).toBe('0.4 stops a day');
    expect(signText(sign('service', 2, ['service_overdue'], 1200, 1000, 120), t)).toBe('Service overdue: 1200 h run of 1000 h');
    expect(signText(sign('service', 1, ['service_due'], 920, 1000, 92), t)).toBe('Service due: 920 h run of 1000 h');
    expect(signText(sign('service', 0, ['service_ok'], 500, 1000, 50), t)).toBe('500 h run since service, of 1000 h');
  });

  it('its tone', () => {
    expect(signTone({ severity: 0 })).toBe('good');
    expect(signTone({ severity: 1 })).toBe('warn');
    expect(signTone({ severity: 2 })).toBe('warn');
    expect(signTone({ severity: 3 })).toBe('bad');
  });
});

describe("the page's words", () => {
  const summary = (conditions: Record<string, number>, machines = 6) => ({ summary: { machines, conditions } });

  it('the sentence on top: service now, else soon, else watch, else all well; nothing without signs', () => {
    expect(overviewWords(summary({ now: 1, soon: 2, watch: 1, healthy: 1, no_data: 1 }), t, tn)).toEqual({ tone: 'bad', title: '1 machine needs a service now', subtitle: '5 of 6 machines have signs to read' });
    expect(overviewWords(summary({ now: 0, soon: 2, watch: 1, healthy: 2, no_data: 1 }), t, tn).title).toBe('2 machines need a service soon');
    expect(overviewWords(summary({ now: 0, soon: 0, watch: 1, healthy: 4, no_data: 1 }), t, tn)).toMatchObject({ tone: 'warn', title: '1 machine to watch' });
    expect(overviewWords(summary({ now: 0, soon: 0, watch: 0, healthy: 5, no_data: 1 }), t, tn)).toMatchObject({ tone: 'good', title: 'Every machine looks healthy' });
    expect(overviewWords(summary({ no_data: 6 }), t, tn)).toMatchObject({ tone: 'idle', title: 'No signs yet' });
  });

  it('the pie: conditions in order with their colours', () => {
    expect(conditionSlices(summary({ now: 1, soon: 2, watch: 0, healthy: 3, no_data: 0 }), t)).toEqual([
      { label: 'Healthy', value: 3, color: SLICE_COLORS.good },
      { label: 'Watch', value: 0, color: '#fbbf24' },
      { label: 'Service soon', value: 2, color: SLICE_COLORS.warn },
      { label: 'Service now', value: 1, color: SLICE_COLORS.bad },
      { label: 'No data', value: 0, color: SLICE_COLORS.idle },
    ]);
    expect(conditionInfo('now')).toMatchObject({ word: 'Service now', tone: 'bad' });
    expect(conditionInfo('no_data')).toMatchObject({ tone: 'idle' });
  });

  it('when the next service falls due', () => {
    expect(nextServiceWords({ next_service: { hours_left: 300, days_left: 20, hours_per_day: 15 }, service_interval_hours: 1000 }, t, tn)).toBe('Next service in about 20 days (300 h)');
    expect(nextServiceWords({ next_service: { hours_left: 10, days_left: 1, hours_per_day: 10 }, service_interval_hours: 1000 }, t, tn)).toBe('Next service in about 1 day (10 h)');
    expect(nextServiceWords({ next_service: { hours_left: 300, days_left: null, hours_per_day: null }, service_interval_hours: 1000 }, t, tn)).toBe('Next service in 300 running hours');
    expect(nextServiceWords({ next_service: { hours_left: -40, days_left: -4, hours_per_day: 10 }, service_interval_hours: 1000 }, t, tn)).toBe('Service overdue by 40 h');
    expect(nextServiceWords({ next_service: null, service_interval_hours: null }, t, tn)).toBe('No service interval set');
    expect(nextServiceWords({ next_service: null, service_interval_hours: 1000 }, t, tn)).toBeNull();
  });
});
