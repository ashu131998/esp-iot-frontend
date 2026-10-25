import { describe, expect, it } from 'vitest';

import { mergeTrendDays, trendDayRange } from '@/lib/trend-days';
import type { MachineDailyTrendDay } from '@/lib/types';

const day = (date: string, figures: Partial<MachineDailyTrendDay> = {}): MachineDailyTrendDay => ({
  date, availability_percent: 50, uptime_minutes: 360, downtime_minutes: 360,
  throughput_percent: 60, performance_percent: 30, units_produced: 72000, ...figures,
});
const RANGE = { from: '2026-10-20', to: '2026-10-25', today: '2026-10-25' };

describe('mergeTrendDays (machine page chart and table)', () => {
  it('settled days come from the saved totals', () => {
    const out = mergeTrendDays([day('2026-10-23')], [day('2026-10-23', { availability_percent: 99 })], RANGE);
    expect(out).toEqual([{ ...day('2026-10-23'), key: '2026-10-23', is_live: false }]);
  });

  it('today is the live day, taken whole: its performance never mixes with a saved part-day', () => {
    // saved has the night shift that ended this morning; live has today so far
    const saved = [day('2026-10-25', { availability_percent: 90, performance_percent: 85 })];
    const live = [day('2026-10-25', { availability_percent: 80, throughput_percent: 90, performance_percent: 72, units_produced: 2160 })];
    expect(mergeTrendDays(saved, live, RANGE)).toEqual([{ ...live[0], key: '2026-10-25', is_live: true }]);
  });

  it('a recent day not saved yet is filled from live, and is not marked as today', () => {
    const out = mergeTrendDays([], [day('2026-10-24', { availability_percent: 70 })], RANGE);
    expect(out).toEqual([{ ...day('2026-10-24', { availability_percent: 70 }), key: '2026-10-24', is_live: false }]);
  });

  it('keeps to the selected range: live days outside it are not added', () => {
    const out = mergeTrendDays([day('2026-10-02')], [day('2026-10-24'), day('2026-10-25')],
      { from: '2026-10-01', to: '2026-10-07', today: '2026-10-25' });
    expect(out.map((d) => d.key)).toEqual(['2026-10-02']);
  });

  it('sorts by day, and keys IST-dated rows by their own date', () => {
    const out = mergeTrendDays([day('2026-10-23T00:00:00+05:30'), day('2026-10-21')], [day('2026-10-22')], RANGE);
    expect(out.map((d) => d.key)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
  });

  it('today from saved totals still counts as today when the live answer is missing', () => {
    expect(mergeTrendDays([day('2026-10-25')], undefined, RANGE)[0].is_live).toBe(true);
  });
});

describe('trendDayRange', () => {
  it('uses the dates in the URL', () => {
    expect(trendDayRange('2026-10-01T06:00', '2026-10-07T18:00', new Date(2026, 9, 25, 19, 30)))
      .toEqual({ from: '2026-10-01', to: '2026-10-07', today: '2026-10-25' });
  });

  it('live: from the production day start to today', () => {
    expect(trendDayRange(undefined, undefined, new Date(2026, 9, 25, 19, 30)))
      .toEqual({ from: '2026-10-25', to: '2026-10-25', today: '2026-10-25' });
    // before 06:00 the production day began yesterday
    expect(trendDayRange(undefined, undefined, new Date(2026, 9, 25, 4, 0)))
      .toEqual({ from: '2026-10-24', to: '2026-10-25', today: '2026-10-25' });
  });
});
