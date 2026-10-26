import { describe, expect, it } from 'vitest';

import { capacityVerdict, fullInLabel, growthLabel, machinesLabel, type Capacity } from '@/lib/capacity';

const today: Capacity = {
  disk: { total: 40e9, used: 23e9, free: 17e9, used_pct: 57.5 },
  db_bytes: 283e6, growth_bytes_per_day: 50 * 1024 * 1024, days_until_full: 260,
  machines: 21, machine_limit: 300, verdict: 'ok',
};

describe('capacityVerdict', () => {
  it('ok, plan a volume, add one now', () => {
    expect(capacityVerdict(today)).toMatchObject({ label: 'OK', tone: 'good' });
    expect(capacityVerdict({ ...today, verdict: 'plan' })).toMatchObject({ label: 'Plan a volume', tone: 'warn' });
    expect(capacityVerdict({ ...today, verdict: 'act' })).toMatchObject({ label: 'Add a volume now', tone: 'bad' });
  });
});

describe('labels', () => {
  it('growth: a day\'s, not growing, or still measuring', () => {
    expect(growthLabel(today)).toBe('+50.0 MB a day');
    expect(growthLabel({ ...today, growth_bytes_per_day: -100 })).toBe('Not growing');
    expect(growthLabel({ ...today, growth_bytes_per_day: null })).toMatch(/Measuring/);
  });

  it('full in: days when close, months when not, years when far; or why not known', () => {
    expect(fullInLabel(today)).toBe('About 9 months');
    expect(fullInLabel({ ...today, days_until_full: 45 })).toBe('45 days');
    expect(fullInLabel({ ...today, days_until_full: 1 })).toBe('1 day');
    expect(fullInLabel({ ...today, days_until_full: 900 })).toBe('Over 2 years');
    expect(fullInLabel({ ...today, days_until_full: null, growth_bytes_per_day: null })).toBe('Measuring');
    expect(fullInLabel({ ...today, days_until_full: null, growth_bytes_per_day: -5 })).toBe('Not filling');
  });

  it('machines against what the server carries', () => {
    expect(machinesLabel(today)).toBe('21 of ~300');
  });
});
