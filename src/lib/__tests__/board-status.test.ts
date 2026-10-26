import { describe, expect, it } from 'vitest';

import { batteryClock, firmware, formatBytes, loginStatus, queue, supply } from '@/lib/board-status';

describe('batteryClock', () => {
  it('kept through the last power-up: OK', () => {
    expect(batteryClock({ rtc: 'kept', reset_reason: 'power_on' })).toMatchObject({ label: 'OK', tone: 'good' });
  });

  it('stopped after a real power cut: no battery reached it', () => {
    expect(batteryClock({ rtc: 'stopped', reset_reason: 'power_on' })).toMatchObject({ label: 'No battery', tone: 'bad' });
    expect(batteryClock({ rtc: 'stopped', reset_reason: 'brownout' }).label).toBe('No battery');
  });

  it('stopped after a restart with the power on (an update): not known yet', () => {
    expect(batteryClock({ rtc: 'stopped', reset_reason: 'software' })).toMatchObject({ label: 'Not checked yet', tone: 'neutral' });
  });

  it('no chip, a wrong time, older firmware', () => {
    expect(batteryClock({ rtc: 'none' }).label).toBe('No clock chip');
    expect(batteryClock({ rtc: 'wrong' }).tone).toBe('warn');
    expect(batteryClock({}).label).toBe('—');
    expect(batteryClock(null).label).toBe('—');
  });
});

describe('queue', () => {
  it('empty, a little waiting, a lot waiting', () => {
    expect(queue({ q_bytes: 0 })).toMatchObject({ label: 'Empty', tone: 'good' });
    expect(queue({ q_bytes: 1244 })).toMatchObject({ label: '1.2 KB waiting', tone: 'neutral' });
    expect(queue({ q_bytes: 200 * 1024 })).toMatchObject({ label: '200.0 KB waiting', tone: 'warn' });
    expect(queue({}).label).toBe('—');
  });
});

describe('supply', () => {
  it('24 V is fine; under 20 V is flagged (low, or bench power)', () => {
    expect(supply({ vin_v: 23.9 })).toMatchObject({ label: '23.9 V', tone: 'good' });
    expect(supply({ vin_v: 3.1 })).toMatchObject({ label: '3.1 V', tone: 'warn' });
    expect(supply(undefined).label).toBe('—');
  });
});

describe('firmware and bytes', () => {
  it('formats', () => {
    expect(firmware({ fw: '2.0.8-uni' })).toBe('2.0.8-uni');
    expect(firmware(null)).toBe('—');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('loginStatus', () => {
  it('own login in use; issued but not in use yet; shared; unknown', () => {
    expect(loginStatus({ login: 'own', own_login: true })).toMatchObject({ label: 'Own', tone: 'good' });
    expect(loginStatus({ login: 'shared', own_login: true })).toMatchObject({ label: 'Issued, not in use', tone: 'warn' });
    expect(loginStatus({ login: null, own_login: true }).label).toBe('Issued, not in use');
    expect(loginStatus({ login: 'shared', own_login: false })).toMatchObject({ label: 'Shared', tone: 'warn' });
    expect(loginStatus({ login: null, own_login: false }).label).toBe('—');
  });
});
