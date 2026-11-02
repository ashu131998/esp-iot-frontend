import { describe, expect, it } from 'vitest';

import {
  caseStudyText, dayInputToIso, dayInputValue, formatPct, formatRupees, formatSignedHours, monthLabel,
  parseRupeesInput, recoveredTone, setupStepHref, type ResultsResponse,
} from '@/lib/results';

const base: ResultsResponse = {
  factory_id: 'mill-01',
  month: '2026-10',
  from: '2026-09-30T18:30:00.000Z',
  to: '2026-10-31T18:30:00.000Z',
  months: ['2026-10', '2026-09'],
  machines_monitored: 38,
  baseline: { from: '2026-08-01T00:30:00.000Z', to: '2026-08-31T00:30:00.000Z', source: 'first_month', ready: true, days_done: 30, days_total: 30, closed_shifts: 2 },
  window: { from: '2026-09-30T18:30:00.000Z', to: '2026-10-31T18:30:00.000Z' },
  data_to: '2026-10-31T12:30:00.000Z',
  closed_shifts: 4,
  totals: {
    compared_machines: 38, watched_hours: 17000, recovered_hours: 412.4, baseline_running_pct: 68.2, running_pct: 70.6,
    stopped_hours: 4998, stopped_hours_at_baseline: 5410.4,
  },
  machines: [],
  money: {
    recovered_rupees: 144340, service_fee_rupees: 57000, net_rupees: 87340, return_multiple: 2.5,
    setup_fee_rupees: null, payback_months: null, no_upfront_cost: true,
  },
  since_baseline: {
    from: '2026-08-31T00:30:00.000Z', to: '2026-11-02T06:00:00.000Z',
    totals: {
      compared_machines: 38, watched_hours: 40000, recovered_hours: 1230.5, baseline_running_pct: 68.2, running_pct: 70.1,
      stopped_hours: 1, stopped_hours_at_baseline: 2,
    },
    money: { recovered_rupees: 430675, service_fee_rupees: 1, net_rupees: 1, return_multiple: 1, setup_fee_rupees: null, payback_months: null, no_upfront_cost: true },
  },
  stops: {
    stops: 230, alerts: 212, alerts_acted_on: 198, alerts_acted_on_pct: 93.4, acted_on: 200, acted_on_pct: 87, explained: 190,
    explained_pct: 82.6, fixed_confirmed: 40, running_again: 228, closed: 196, still_stopped: 2,
    median_minutes_to_reason: 3, median_minutes_to_running: 14, reasons: [],
  },
  settings: {
    value_per_loom_hour: 350, fee_per_machine_month: 1500, setup_fee: null, baseline_from: null, baseline_to: null,
    monthly_email: true, monthly_email_rupees: false, last_report_month: null, updated_at: null,
  },
};

describe('formatting', () => {
  it('signs hours, rounding the size so a loss reads as large as the same gain', () => {
    expect(formatSignedHours(412.44)).toBe('+412.4 h');
    expect(formatSignedHours(-3.25)).toBe('−3.3 h');
    expect(formatSignedHours(3.25)).toBe('+3.3 h');
    expect(formatSignedHours(0.02)).toBe('0 h');
    expect(formatSignedHours(1234.5)).toBe('+1,234.5 h');
    expect(formatSignedHours(null)).toBe('—');
  });
  it('writes rupees and percentages the Indian way', () => {
    expect(formatRupees(1443400)).toBe('₹14,43,400');
    expect(formatRupees(-1200.4)).toBe('−₹1,200');
    expect(formatRupees(-0.2)).toBe('₹0');
    expect(formatRupees(undefined)).toBe('—');
    expect(formatPct(72.5)).toBe('72.5%');
    expect(formatPct(null)).toBe('—');
  });
  it('names months in the page language', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('2026-10', 'hi')).toContain('2026');
    expect(monthLabel('2026-10', 'hi')).not.toContain('October');
    expect(monthLabel('garbage')).toBe('garbage');
  });
  it('colours gains green, losses red, nothing grey', () => {
    expect(recoveredTone(12)).toBe('good');
    expect(recoveredTone(-0.4)).toBe('bad');
    expect(recoveredTone(0.01)).toBe('idle');
    expect(recoveredTone(null)).toBe('idle');
  });
});

describe('setupStepHref', () => {
  it('sends each rollout step to the page that does it', () => {
    expect(setupStepHref('mapped', 'mill-01')).toBe('/factories/mill-01/sensor-mapping');
    expect(setupStepHref('live', 'mill-01')).toBe('/factories/mill-01/status-timeline');
    expect(setupStepHref('reports', 'mill-01')).toBe('/factories/mill-01/shift-reports');
    expect(setupStepHref('value', 'mill-01')).toBe('/factories/mill-01/results?settings=1');
    expect(setupStepHref('first_shift', 'mill-01')).toBeNull();
  });
});

describe('settings inputs', () => {
  it('reads amounts as typed, empty as cleared, anything else as not an amount', () => {
    expect(parseRupeesInput('1,250')).toBe(1250);
    expect(parseRupeesInput(' ₹ 350.5 ')).toBe(350.5);
    expect(parseRupeesInput('')).toBeNull();
    expect(parseRupeesInput('-5')).toBeUndefined();
    expect(parseRupeesInput('lots')).toBeUndefined();
  });
  it('turns instants into IST days and back', () => {
    expect(dayInputValue('2026-09-30T18:30:00.000Z')).toBe('2026-10-01');
    expect(dayInputValue(null)).toBe('');
    expect(dayInputToIso('2026-10-01')).toBe('2026-09-30T18:30:00.000Z');
    expect(dayInputToIso('')).toBeNull();
  });
});

describe('caseStudyText', () => {
  it('states hours, rupees, the fee, payback and follow-up with the customer name', () => {
    const text = caseStudyText({ factoryName: 'Shree Textiles', location: 'Surat', results: base });
    expect(text.split('\n')).toEqual([
      'Shree Textiles, Surat — FloorBeat results, October 2026',
      '',
      '• Machines monitored: 38',
      '• Loom-hours recovered in October 2026: +412.4 h against the first month (running 68.2% → 70.6%)',
      '• Worth: ₹1,44,340 at ₹350 a loom-hour',
      '• Service fee for the period: ₹57,000 — returned 2.5×',
      '• Upfront cost: none (Machine Monitoring as a Service)',
      '• Since the first month: +1,230.5 h, worth ₹4,30,675',
      '• Stop alerts acted on: 198 of 212 (93.4%), running again in a median of 14 minutes',
      '',
      'Machine Monitoring as a Service by FloorBeat — floorbeat.in',
    ]);
  });
  it('says what it does not know instead of inventing it', () => {
    const text = caseStudyText({
      factoryName: 'Mill',
      results: { ...base, totals: null, money: null, settings: null, since_baseline: null, stops: null },
    });
    expect(text).toContain('still measuring the first month');
    expect(text).not.toContain('₹');
    expect(text).not.toContain('Stop alerts');
  });
  it('gives the payback of a setup fee', () => {
    const text = caseStudyText({
      factoryName: 'Mill',
      results: { ...base, money: { ...base.money!, no_upfront_cost: false, setup_fee_rupees: 50000, payback_months: 0.6 } },
    });
    expect(text).toContain('• Setup fee paid back in 0.6 months');
  });
});
