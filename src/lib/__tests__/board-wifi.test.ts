import { describe, expect, it } from 'vitest';

import {
  attemptView, bars, boardName, boardWifiPath, connectNeeds, minutesAgo, networkRows, passwordOk, pollMs, scanState, wifiProblem,
  type BoardWifi,
} from '@/lib/board-wifi';

const WIFI: BoardWifi = {
  board_id: 'cam-478998', factory_id: 'factory-01', machines: ['Dye 3'], camera: true, factory_networks: [{ ssid: 'Mill' }],
  saved: [{ ssid: 'Jio5G', own: true, open: false }, { ssid: 'Mill', own: false, open: false }],
  preferred: null, max: 8, room: 6, editable: true, reason: null, can: { connect: true, manage: false },
  status: 'current', cfg_version: 5000, online: true, ssid: 'Jio5G', rssi: -61,
  scans: true, seen: [{ ssid: 'Mill', rssi: -55, open: false }, { ssid: 'Jio5G', rssi: -61, open: false }, { ssid: 'Cafe', rssi: -80, open: true }],
  seen_at: '2026-11-20T10:00:00.000Z', scan_asked: 2, scan_done: 2, attempt: null,
};

describe('a board\'s WiFi as on a phone', () => {
  it('asks its factory\'s page, or ops for our super admin', () => {
    expect(boardWifiPath({ factoryId: 'factory-01' }, 'cam-478998')).toBe('/v1/factories/factory-01/boards/cam-478998/wifi');
    expect(boardWifiPath(null, 'revb 1')).toBe('/v1/admin/boards/revb%201/wifi');
  });

  it('signal bars as a phone draws them', () => {
    expect([-50, -60, -61, -70, -71, -80, -81, -95].map(bars)).toEqual([4, 4, 3, 3, 2, 2, 1, 1]);
    expect([null, undefined, 0, 5].map(bars)).toEqual([0, 0, 0, 0]);
  });

  it('the list: the one it is on first, then by signal; saved ones marked; each once', () => {
    const rows = networkRows({ ...WIFI, seen: [...WIFI.seen, { ssid: 'Mill', rssi: -90, open: false }] });
    expect(rows.map((r) => [r.ssid, r.connected, r.saved?.own ?? null])).toEqual([
      ['Jio5G', true, true], ['Mill', false, false], ['Cafe', false, null],
    ]);
  });

  it('on a network its last scan did not show: still listed first; offline: none is "connected"', () => {
    const rows = networkRows({ ...WIFI, seen: [{ ssid: 'Cafe', rssi: -80, open: true }] });
    expect(rows[0]).toEqual({ ssid: 'Jio5G', rssi: -61, open: false, connected: true, saved: WIFI.saved[0] });
    expect(networkRows({ ...WIFI, online: false }).some((r) => r.connected)).toBe(false);
    expect(networkRows({ ...WIFI, seen: [], online: false })).toEqual([]);
    expect(networkRows({ ...WIFI, seen: [], ssid: 'Hidden', saved: [] })[0]).toMatchObject({ ssid: 'Hidden', open: false, saved: null });
  });

  it('a tap: nothing on the one it is on; Connect for a saved or open one; else its password', () => {
    const [on, mill, cafe] = networkRows(WIFI);
    expect([connectNeeds(on), connectNeeds(mill), connectNeeds(cafe)]).toEqual(['none', 'connect', 'connect']);
    expect(connectNeeds({ connected: false, saved: null, open: false })).toBe('password');
  });

  it('a password the board can use: 8–63 plain characters', () => {
    expect(['1234567', '12345678', 'x'.repeat(63), 'x'.repeat(64), 'pässwört1'].map(passwordOk)).toEqual([false, true, true, false, false]);
  });

  it('its scan: older firmware cannot; under way; waiting for it to be back; done', () => {
    expect(scanState({ ...WIFI, scans: false })).toBe('unsupported');
    expect(scanState({ ...WIFI, scan_asked: 3 })).toBe('scanning');
    expect(scanState({ ...WIFI, scan_asked: 3, online: false })).toBe('waiting');
    expect(scanState(WIFI)).toBe('idle');
  });

  it('why a connect did not work, from the board\'s code', () => {
    expect([15, 202, 204, 201, 203, 205, 200, 4, 34, 250, 99].map(wifiProblem)).toEqual([
      'password', 'password', 'password', 'not-found', 'refused', 'refused', 'signal', 'signal', 'signal', 'no-internet', 'other',
    ]);
    expect([null, undefined, 0].map(wifiProblem)).toEqual([null, null, null]);
  });

  it('the connect asked for: under way, waiting for it, or failed (a new password only for one of its own or a new one)', () => {
    expect(attemptView(WIFI)).toBeNull();
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Mill', state: 'connected', reason: null } })).toBeNull();   // the top line says so
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Mill', state: 'trying', reason: null } })).toEqual({ state: 'trying', ssid: 'Mill', problem: null, newPassword: false });
    expect(attemptView({ ...WIFI, online: false, attempt: { ssid: 'Mill', state: 'trying', reason: null } })?.state).toBe('waiting');
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Jio5G', state: 'failed', reason: 15 } })).toEqual({ state: 'failed', ssid: 'Jio5G', problem: 'password', newPassword: true });
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Shop', state: 'failed', reason: 202 } })?.newPassword).toBe(true);    // a new one
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Mill', state: 'failed', reason: 15 } })?.newPassword).toBe(false);   // the factory's: its admins
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Shop', state: 'failed', reason: 250 } })).toMatchObject({ problem: 'no-internet', newPassword: false });
    expect(attemptView({ ...WIFI, attempt: { ssid: 'Shop', state: 'failed', reason: null } })?.problem).toBe('other');
  });

  it('looks again every 2 s while it scans, connects or takes a change (online); else every 10 s', () => {
    expect(pollMs(WIFI)).toBe(10_000);
    expect(pollMs({ ...WIFI, scan_asked: 3 })).toBe(2_000);
    expect(pollMs({ ...WIFI, attempt: { ssid: 'Mill', state: 'trying', reason: null } })).toBe(2_000);
    expect(pollMs({ ...WIFI, status: 'waiting' })).toBe(2_000);
    expect(pollMs({ ...WIFI, status: 'waiting', online: false })).toBe(10_000);
  });

  it('minutes since a time; a board by its machines, else its ID', () => {
    const now = Date.parse('2026-11-20T10:05:30.000Z');
    expect(minutesAgo('2026-11-20T10:00:00.000Z', now)).toBe(5);
    expect(minutesAgo('2026-11-20T10:10:00.000Z', now)).toBe(0);
    expect([minutesAgo(null, now), minutesAgo('soon', now)]).toEqual([null, null]);
    expect(boardName({ machines: ['Machine 1', 'Machine 2'], board_id: 'revb-1' })).toBe('Machine 1, Machine 2');
    expect(boardName({ machines: [], board_id: 'revb-1' })).toBe('revb-1');
    expect(boardName({ board_id: 'revb-1' })).toBe('revb-1');
  });
});
