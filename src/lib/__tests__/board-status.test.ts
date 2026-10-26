import { describe, expect, it } from 'vitest';

import {
  batteryClock, firmware, formatBytes, loginStatus, queue, restrictionPlan, serviceLoginStatus, supply, timeSource,
  type BrokerLogins,
} from '@/lib/board-status';

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

describe('timeSource', () => {
  it('internet time, or the server\'s where internet time is blocked: both right', () => {
    expect(timeSource({ clock: 'ntp' })).toMatchObject({ label: 'Internet', tone: 'good' });
    expect(timeSource({ clock: 'server' })).toMatchObject({ label: 'From server', tone: 'good' });
  });

  it('still the estimate from power-up, or no time at all', () => {
    expect(timeSource({ clock: 'estimated' })).toMatchObject({ label: 'Estimated', tone: 'warn' });
    expect(timeSource({ clock: 'none' })).toMatchObject({ label: 'No time', tone: 'bad' });
  });

  it('older firmware does not say; something new is shown as it is', () => {
    expect(timeSource({ synced: true }).label).toBe('—');
    expect(timeSource(null).label).toBe('—');
    expect(timeSource({ clock: 'gps' })).toMatchObject({ label: 'gps', tone: 'neutral' });
  });
});

describe('queue', () => {
  it('empty, a little waiting, a lot waiting', () => {
    expect(queue({ q_bytes: 0 })).toMatchObject({ label: 'Empty', tone: 'good' });
    expect(queue({ q_bytes: 1244 })).toMatchObject({ label: '1.2 KB waiting', tone: 'neutral' });
    expect(queue({ q_bytes: 200 * 1024 })).toMatchObject({ label: '200.0 KB waiting', tone: 'warn' });
    expect(queue({}).label).toBe('—');
  });

  it('where it is and how much room (2.3+): a quarter of the room waiting is worth a look', () => {
    const chip = { qloc: 'ext', q_cap: 12 * 1024 * 1024 };
    expect(queue({ ...chip, q_bytes: 0 })).toEqual({
      label: 'Empty', tone: 'good', detail: 'Everything it measured has reached the server. On the 16 MB flash chip (room for 12.0 MB).',
    });
    expect(queue({ ...chip, q_bytes: 200 * 1024 }).tone).toBe('neutral');        // 200 KB of 12 MB: fine
    expect(queue({ ...chip, q_bytes: 4 * 1024 * 1024 }).tone).toBe('warn');      // a third of it
    expect(queue({ qloc: 'int', q_cap: 768 * 1024, q_bytes: 0 }).detail).toMatch(/board's own flash \(room for 768\.0 KB\)/);
    expect(queue({ qloc: 'none', q_bytes: 0 }).detail).toMatch(/only goes out live/);
  });

  it('anything a full queue dropped is said, and makes it worth a look', () => {
    const r = queue({ qloc: 'ext', q_cap: 131072, q_bytes: 0, q_dropped: 319284 });
    expect(r.tone).toBe('warn');
    expect(r.detail).toMatch(/311\.8 KB dropped since it was set up/);
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
    expect(formatBytes(40e9)).toBe('37.3 GB');   // a server disk
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

describe('serviceLoginStatus', () => {
  it('own login, still shared, not connected (the bridge missing is bad; the demo producer is optional)', () => {
    expect(serviceLoginStatus({ service: 'bridge', username: 'svc-bridge', online: true, login: 'own' })).toMatchObject({ label: 'Own login', tone: 'good' });
    expect(serviceLoginStatus({ service: 'bridge', username: 'svc-bridge', online: true, login: 'shared' })).toMatchObject({ label: 'Shared login', tone: 'warn' });
    expect(serviceLoginStatus({ service: 'bridge', username: 'svc-bridge', online: false, login: null })).toMatchObject({ label: 'Not connected', tone: 'bad' });
    expect(serviceLoginStatus({ service: 'mock', username: 'svc-mock', online: false, login: null }).tone).toBe('neutral');
  });
});

describe('restrictionPlan', () => {
  const logins = (services: BrokerLogins['services'], kinds: Array<'board' | 'new-board' | 'service' | 'other'>): BrokerLogins => ({
    services,
    shared: { username: 'espiot', restricted: false, clients: kinds.map((kind, i) => ({ clientid: `c${i}`, ip: null, kind })) },
  });
  const own = { service: 'bridge', username: 'svc-bridge', online: true, login: 'own' as const };

  it('services on their own logins: allowed; cuts off every client but new boards', () => {
    const plan = restrictionPlan(logins([own], ['new-board', 'board', 'other']));
    expect(plan.blockedBy).toEqual([]);
    expect(plan.cutOff.map((c) => c.clientid)).toEqual(['c1', 'c2']);
  });

  it('refused while the bridge uses the shared login or is not connected, or the demo producer uses it', () => {
    expect(restrictionPlan(logins([{ ...own, login: 'shared' }], [])).blockedBy).toEqual(['Data bridge still uses it']);
    expect(restrictionPlan(logins([{ ...own, online: false, login: null }], [])).blockedBy).toEqual(['Data bridge is not connected']);
    expect(restrictionPlan(logins([own, { service: 'mock', username: 'svc-mock', online: true, login: 'shared' }], [])).blockedBy)
      .toEqual(['Demo data producer still uses it']);
    expect(restrictionPlan(logins([own, { service: 'mock', username: 'svc-mock', online: false, login: null }], [])).blockedBy).toEqual([]);
  });
});
