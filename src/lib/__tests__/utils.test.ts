import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatPercent,
  formatAlertVia,
  normalizeMachineStatus,
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
