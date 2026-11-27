import { describe, expect, it } from 'vitest';

import { HOME_REFRESH_MS, runningLine, stockLine } from '@/components/dashboard-app/home-screen';

/** The FloorBeat app's home screen: the live line under each tile (components/dashboard-app/home-screen.tsx). */
describe('the home screen tiles\' lines', () => {
  it('the dashboard tile: how many machines run now, of all of them', () => {
    expect(runningLine([{ status: 'up' }, { status: 'down' }, { status: 'estimated' }, { status: 'unknown' }])).toEqual({ running: 2, total: 4 });
    expect(runningLine([{ status: 'off' }, { status: 'no_signal' }])).toEqual({ running: 0, total: 2 });
    // a factory with no machines yet, and the answer not in yet
    expect(runningLine([])).toEqual({ running: 0, total: 0 });
    expect(runningLine(undefined)).toBeNull();
  });

  it('the stock tile: each unit\'s quantity in stock, units never added together', () => {
    expect(stockLine([{ unit: 'm', qty: 1240 }, { unit: 'pcs', qty: 36 }], 'en')).toBe('1,240 m · 36 pcs');
    expect(stockLine([{ unit: 'm', qty: 12.5 }], 'en')).toBe('12.5 m');
    expect(stockLine([{ unit: 'kg', qty: 125000 }], 'hi')).toBe('1,25,000 kg');   // Indian grouping
  });

  it('the stock tile says nothing in stock when nothing is counted', () => {
    expect(stockLine([], 'en')).toBeNull();
    expect(stockLine(undefined, 'en')).toBeNull();
    expect(stockLine([{ unit: 'm', qty: null }, { unit: 'pcs', qty: 0 }], 'en')).toBeNull();   // not counted, or none left
    expect(stockLine([{ unit: 'm', qty: null }, { unit: 'pcs', qty: 4 }], 'en')).toBe('4 pcs');
  });

  it('the lines are asked for again every minute while the home screen shows', () => {
    expect(HOME_REFRESH_MS).toBe(60_000);
  });
});
