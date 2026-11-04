import { describe, expect, it } from 'vitest';

import { formatNumber, formatRupees, parseNumber, roiFigures } from '../public/roi-calc.js';

const base = { machines: 24, stopHoursPerShift: 2, shiftsPerDay: 2, daysPerMonth: 26, valuePerHour: 300, winBackPct: 10 };

describe('parseNumber', () => {
  it('reads what people type', () => {
    expect(parseNumber('1,250')).toBe(1250);
    expect(parseNumber(' ₹ 300 ')).toBe(300);
    expect(parseNumber('2.5')).toBe(2.5);
  });
  it('is NaN for anything else', () => {
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('-3')).toBeNaN();
    expect(parseNumber('ten')).toBeNaN();
  });
});

describe('roiFigures', () => {
  it('works out the stop hours, the loss and what winning some back is worth', () => {
    const r = roiFigures(base)!;
    expect(r.stopHours).toBe(2496);              // 24 × 2 × 2 × 26
    expect(r.lostRupees).toBe(748800);
    expect(r.wonBackHours).toBeCloseTo(249.6, 6);
    expect(r.wonBackRupees).toBeCloseTo(74880, 6);
    expect(r.breakEvenFee).toBeCloseTo(3120, 6);  // pays for itself below ₹3,120 a machine a month
    expect(r.fee).toBeNull();
    expect(r.returnMultiple).toBeNull();
    expect(r.paybackMonths).toBeNull();
  });
  it('sets the quoted fee against it: net, return and payback', () => {
    const r = roiFigures({ ...base, feePerMachine: 1500, setupFee: 72000 })!;
    expect(r.fee).toBe(36000);
    expect(r.net).toBeCloseTo(38880, 6);
    expect(r.returnMultiple).toBeCloseTo(2.08, 2);
    expect(r.paybackMonths).toBeCloseTo(72000 / 38880, 6);
    expect(roiFigures({ ...base, feePerMachine: 1500 })!.paybackMonths).toBe(0);   // no setup fee: nothing to pay back
  });
  it('has no payback when the fee is more than what is won back', () => {
    const r = roiFigures({ ...base, feePerMachine: 5000, setupFee: 10000 })!;
    expect(r.net).toBeLessThan(0);
    expect(r.paybackMonths).toBeNull();
  });
  it('waits for sensible inputs', () => {
    expect(roiFigures({ ...base, machines: 0 })).toBeNull();
    expect(roiFigures({ ...base, machines: Number.NaN })).toBeNull();
    expect(roiFigures({ ...base, stopHoursPerShift: 13 })).toBeNull();   // more than a 12 h shift
    expect(roiFigures({ ...base, winBackPct: 120 })).toBeNull();
    expect(roiFigures({ ...base, shiftsPerDay: 4 })).toBeNull();
  });
});

describe('formatting', () => {
  it('writes rupees and numbers the Indian way', () => {
    expect(formatRupees(748800)).toBe('₹7,48,800');
    expect(formatRupees(-1200.4)).toBe('−₹1,200');
    expect(formatRupees(Number.NaN)).toBe('—');
    expect(formatNumber(2496)).toBe('2,496');
    expect(formatNumber(249.64, 1)).toBe('249.6');
  });
});
