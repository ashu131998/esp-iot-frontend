import { describe, expect, it } from 'vitest';

import {
  addDays, addMonths, currentPeriod, draftBody, draftOf, draftProblems, formatDay, formatPeriod, isDayKey,
  nextPeriodDraft, periodEnd, subscriptionBadge, todayKey, type SubscriptionPeriod,
} from '@/lib/subscriptions';

const period = (id: number, starts_on: string, ends_on: string, extra: Partial<SubscriptionPeriod> = {}): SubscriptionPeriod => ({
  id, factory_id: 'mill-01', starts_on, ends_on, plan: null, machines: null, monthly_amount: null, notes: null,
  reminders_sent: {}, created_by: 'staff', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', ...extra,
});

describe('calendar days', () => {
  it('real days only', () => {
    expect(isDayKey('2026-12-01')).toBe(true);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('1 Dec')).toBe(false);
  });

  it('adding days and months; a month later stays inside a shorter month', () => {
    expect(addDays('2026-12-01', 1)).toBe('2026-12-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 12)).toBe('2027-11-15');
    expect(periodEnd('2026-12-02', 1)).toBe('2027-01-01');
    expect(periodEnd('2026-11-01', 12)).toBe('2027-10-31');
  });

  it('shown as calendar days, never shifted by the viewer\'s zone', () => {
    expect(formatDay('2026-12-01')).toBe('1 Dec 2026');
    expect(formatPeriod('2026-11-01', '2026-12-01')).toBe('1 Nov – 1 Dec 2026');
    expect(formatPeriod('2026-12-02', '2027-01-01')).toBe('2 Dec 2026 – 1 Jan 2027');
  });

  it('today in India: 11 pm UTC on 1 Dec is already 2 Dec there', () => {
    expect(todayKey(new Date('2026-12-01T19:00:00Z'))).toBe('2026-12-02');
    expect(todayKey(new Date('2026-12-01T10:00:00Z'))).toBe('2026-12-01');
  });
});

describe('subscriptionBadge', () => {
  it('one badge per state', () => {
    expect(subscriptionBadge({ state: 'none' })).toEqual({ label: 'No subscription', tone: 'idle' });
    expect(subscriptionBadge(undefined)).toEqual({ label: 'No subscription', tone: 'idle' });
    expect(subscriptionBadge({ state: 'active', ends_on: '2027-10-31', days_left: 362 })).toEqual({ label: 'Active · ends 31 Oct 2027', tone: 'ok' });
    expect(subscriptionBadge({ state: 'ending', ends_on: '2026-12-01', days_left: 28 })).toEqual({ label: 'Ends in 28 days (1 Dec 2026)', tone: 'warn' });
    expect(subscriptionBadge({ state: 'ending', ends_on: '2026-12-01', days_left: 1 }).label).toBe('Ends tomorrow');
    expect(subscriptionBadge({ state: 'ending', ends_on: '2026-12-01', days_left: 0 }).label).toBe('Ends today');
    expect(subscriptionBadge({ state: 'ended', ends_on: '2026-12-01', days_left: -3 })).toEqual({ label: 'Ended 1 Dec 2026', tone: 'bad' });
  });
});

describe('the next period, pre-filled', () => {
  it('from the day after the current end, for a month, on the same plan', () => {
    const periods = [
      period(1, '2026-10-01', '2026-10-31'),
      period(2, '2026-11-01', '2026-12-01', { plan: 'Standard', machines: 40, monthly_amount: 24000 }),
    ];
    expect(currentPeriod(periods)?.id).toBe(2);
    expect(nextPeriodDraft(periods, '2026-11-20')).toEqual({
      starts_on: '2026-12-02', ends_on: '2027-01-01', plan: 'Standard', machines: '40', monthly_amount: '24000', notes: '',
    });
  });

  it('none yet: from today', () => {
    expect(nextPeriodDraft([], '2026-11-03')).toMatchObject({ starts_on: '2026-11-03', ends_on: '2026-12-02', plan: '' });
  });
});

describe('the form', () => {
  const draft = draftOf(period(2, '2026-11-01', '2026-12-01', { plan: 'Standard', machines: 40 }));

  it('an existing period as typed text', () => {
    expect(draft).toEqual({ starts_on: '2026-11-01', ends_on: '2026-12-01', plan: 'Standard', machines: '40', monthly_amount: '', notes: '' });
  });

  it('problems field by field', () => {
    expect(draftProblems(draft)).toEqual({});
    expect(draftProblems({ ...draft, ends_on: '2026-10-01' })).toEqual({ ends_on: 'Ends before it starts' });
    expect(draftProblems({ ...draft, starts_on: '', machines: '4.5', monthly_amount: 'lots' }))
      .toEqual({ starts_on: 'Pick a start date', machines: 'A whole number', monthly_amount: 'A number' });
  });

  it('as the API takes it: blanks become null, spaces tidied', () => {
    expect(draftBody({ ...draft, plan: '  Standard   40 ', monthly_amount: '24000.5', notes: ' ' })).toEqual({
      starts_on: '2026-11-01', ends_on: '2026-12-01', plan: 'Standard 40', machines: 40, monthly_amount: 24000.5, notes: null,
    });
  });
});
