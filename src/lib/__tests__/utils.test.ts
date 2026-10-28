import { describe, it, expect } from 'vitest';
import {
  averageKnown,
  formatNumber,
  knownNumber,
  formatPercent,
  formatAlertVia,
  formatUnits,
  formatVolts,
  normalizeMachineStatus,
  sharedUnitLabel,
  sumUnits,
  statusColor,
  statusLabel,
} from '@/lib/utils';

// ── formatNumber ──────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('returns em-dash for null', () => expect(formatNumber(null)).toBe('—'));
  it('returns em-dash for undefined', () => expect(formatNumber(undefined)).toBe('—'));
  it('returns em-dash for non-numeric string', () => expect(formatNumber('abc')).toBe('—'));
  it('formats integer to 1 decimal by default', () => expect(formatNumber(42)).toBe('42.0'));
  it('formats float to 1 decimal', () => expect(formatNumber(3.14159)).toBe('3.1'));
  it('respects custom decimal places', () => expect(formatNumber(3.14159, 3)).toBe('3.142'));
  it('parses numeric strings', () => expect(formatNumber('12.5')).toBe('12.5'));
  it('handles zero', () => expect(formatNumber(0)).toBe('0.0'));
  it('handles negative values', () => expect(formatNumber(-1.5)).toBe('-1.5'));
});

// ── formatPercent ─────────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('returns em-dash for null', () => expect(formatPercent(null)).toBe('—'));
  it('returns em-dash for undefined', () => expect(formatPercent(undefined)).toBe('—'));
  it('returns em-dash for NaN string', () => expect(formatPercent('nope')).toBe('—'));
  it('formats 85.5 as "85.5%"', () => expect(formatPercent(85.5)).toBe('85.5%'));
  it('formats string "100" as "100.0%"', () => expect(formatPercent('100')).toBe('100.0%'));
  it('formats 0 as "0.0%"', () => expect(formatPercent(0)).toBe('0.0%'));
});

// ── formatAlertVia ────────────────────────────────────────────────────────────

describe('formatAlertVia', () => {
  it.each([null, undefined, 'whatsapp', 'mobile', 'app'])(
    'maps %s → "mobile app"',
    (v) => expect(formatAlertVia(v)).toBe('mobile app'),
  );
  it('maps "dashboard" → "dashboard"', () => expect(formatAlertVia('dashboard')).toBe('dashboard'));
  it('passes through unknown values', () => expect(formatAlertVia('sms')).toBe('sms'));
});

// ── normalizeMachineStatus ────────────────────────────────────────────────────

describe('normalizeMachineStatus', () => {
  it.each(['up', 'on', 'computed', 'estimated', 'estimated_from_latest'])(
    '"%s" → running',
    (s) => expect(normalizeMachineStatus(s)).toBe('running'),
  );
  it.each(['down', 'off'])(
    '"%s" → stopped',
    (s) => expect(normalizeMachineStatus(s)).toBe('stopped'),
  );
  it.each(['unknown', 'offline', '', 'stale'])(
    '"%s" → no_signal',
    (s) => expect(normalizeMachineStatus(s)).toBe('no_signal'),
  );
});

// ── statusColor ───────────────────────────────────────────────────────────────

describe('statusColor', () => {
  it('running → emerald classes', () => expect(statusColor('up')).toContain('emerald'));
  it('estimated → amber classes', () => expect(statusColor('estimated')).toContain('amber'));
  it('estimated_from_latest → amber classes', () =>
    expect(statusColor('estimated_from_latest')).toContain('amber'));
  it('stopped → red classes', () => expect(statusColor('down')).toContain('red'));
  it('no_signal → gray classes', () => expect(statusColor('offline')).toContain('gray'));
});

// ── statusLabel ───────────────────────────────────────────────────────────────

describe('statusLabel', () => {
  it('running → "Running"', () => expect(statusLabel('up')).toBe('Running'));
  it('stopped → "Stopped"', () => expect(statusLabel('down')).toBe('Stopped'));
  it('no_signal → "No signal"', () => expect(statusLabel('stale')).toBe('No signal'));
});

// ── production units ─────────────────────────────────────────────────────────

describe('formatVolts', () => {
  it('adds the unit', () => expect(formatVolts(415)).toBe('415 V'));
  it('keeps decimals as given', () => expect(formatVolts(230.5)).toBe('230.5 V'));
  it('shows a dash alone when unknown', () => {
    expect(formatVolts(null)).toBe('—');
    expect(formatVolts(undefined)).toBe('—');
    expect(formatVolts(Number.NaN)).toBe('—');
  });
});

describe('formatUnits', () => {
  it('adds the unit name', () => expect(formatUnits(25.4, 'm')).toBe('25.4 m'));
  it('keeps whole counts whole and plain without a unit', () => expect(formatUnits(1200, null)).toBe('1200'));
  it('rounds to 2 decimals', () => expect(formatUnits(3.333, 'cm')).toBe('3.33 cm'));
  it('spells out mixed units', () => expect(formatUnits(10, 'mixed')).toBe('10 (mixed units)'));
  it('shows a dash for no value', () => expect(formatUnits(null, 'm')).toBe('—'));
});

describe('sharedUnitLabel / sumUnits', () => {
  it('returns the label all producing machines share', () =>
    expect(sharedUnitLabel([{ unit_label: 'm' }, { unit_label: 'm' }, { unit_label: 'cm', status: 'no_sensor' }])).toBe('m'));
  it('returns mixed when producing machines differ', () =>
    expect(sharedUnitLabel([{ unit_label: 'm' }, { unit_label: 'cm' }])).toBe('mixed'));
  it('returns null for plain units', () => expect(sharedUnitLabel([{ unit_label: null }, {}])).toBeNull());
  it('sums fractional units to 2 decimals', () =>
    expect(sumUnits([{ units_produced: 0.1 }, { units_produced: 0.2 }])).toBe(0.3));
});

// ── knownNumber / averageKnown: unknown is never 0 ───────────────────────────

describe('knownNumber', () => {
  it('keeps real numbers, zero included', () => {
    expect(knownNumber(42.5)).toBe(42.5);
    expect(knownNumber(0)).toBe(0);
    expect(knownNumber('12.5')).toBe(12.5);   // Postgres NUMERIC arrives as text
  });
  it('turns unknown into null, never 0', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity]) expect(knownNumber(v)).toBeNull();
  });
});

describe('averageKnown', () => {
  it('leaves unknown machines out instead of counting them as 0 %', () => {
    // two machines known (50 %, 80 %), one with no data: 65 %, not (50 + 80 + 0) / 3 = 43.3 %
    expect(averageKnown([50, null, 80])).toBe(65);
  });
  it('rounds to one decimal, like the API', () => expect(averageKnown([33.3, 33.4, 33.4])).toBe(33.4));
  it('a known 0 % still counts', () => expect(averageKnown([0, 100])).toBe(50));
  it('is null when nothing is known', () => {
    expect(averageKnown([])).toBeNull();
    expect(averageKnown([null, undefined])).toBeNull();
  });
});
