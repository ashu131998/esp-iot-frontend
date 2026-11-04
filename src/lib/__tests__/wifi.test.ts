import { describe, expect, it } from 'vitest';

import {
  MAX_NETWORKS, boardsOn, dropReason, listChanged, listProblem, listStatus, networkProblem, readiness, rescueCoverage,
  rescueHeard, signal, signalWord, type WifiBoard,
} from '@/lib/wifi';

const board = (over: Partial<WifiBoard>): WifiBoard => ({
  board_id: 'b', line_id: 'l1', online: true, last_beat_at: null, ssid: 'FloorBeat', rssi: -60, last_drop: null,
  firmware: '2.4.0-uni', list: 'current', ...over,
});

describe('networkProblem / listProblem: the firmware\'s rules', () => {
  it('a good network has none', () => {
    expect(networkProblem({ ssid: 'FloorBeat', pass: 'hall-pass-1' })).toBeNull();
    expect(networkProblem({ ssid: 'Guest', pass: '' })).toBeNull();   // open network
    expect(networkProblem({ ssid: 'Ashutosh’s iPhone', pass: '12345678' })).toBeNull();
  });

  it('names: required, at most 32 bytes', () => {
    expect(networkProblem({ ssid: '  ', pass: '' })).toMatch(/Enter the WiFi name/);
    expect(networkProblem({ ssid: 'x'.repeat(33), pass: '' })).toMatch(/32/);
    expect(networkProblem({ ssid: '’'.repeat(11), pass: '' })).toMatch(/32/);   // 33 bytes
  });

  it('passwords: 8-63 plain characters', () => {
    expect(networkProblem({ ssid: 'A', pass: 'short' })).toMatch(/8–63/);
    expect(networkProblem({ ssid: 'A', pass: 'p'.repeat(64) })).toMatch(/8–63/);
    expect(networkProblem({ ssid: 'A', pass: 'pässwort1' })).toMatch(/plain/);
  });

  it('a list: each name once, at most 8', () => {
    expect(listProblem([{ ssid: 'A', pass: '' }, { ssid: ' A ', pass: '' }])).toMatch(/already/);
    const many = Array.from({ length: MAX_NETWORKS + 1 }, (_, i) => ({ ssid: `N${i}`, pass: '' }));
    expect(listProblem(many)).toMatch(/At most 8/);
    expect(listProblem([{ ssid: 'A', pass: 'password' }, { ssid: 'B', pass: '' }])).toBeNull();
  });
});

describe('signal', () => {
  it('in words, with its dBm', () => {
    expect(signal(-55)).toEqual({ label: 'Strong (-55 dBm)', tone: 'good' });
    expect(signal(-65).label).toMatch(/^Good/);
    expect(signal(-75)).toMatchObject({ tone: 'warn' });
    expect(signal(-85)).toMatchObject({ label: 'Very weak (-85 dBm)', tone: 'bad' });
    expect(signal(null)).toEqual({ label: '—', tone: 'neutral' });
    expect(signal(0)).toEqual({ label: '—', tone: 'neutral' });   // the board was not connected
  });

  it('the steps fall on -60, -70 and -80 dBm', () => {
    expect([-60, -61, -70, -71, -80, -81].map((r) => signalWord(r).word))
      .toEqual(['Strong', 'Good', 'Good', 'Weak', 'Weak', 'Very weak']);
  });
});

describe('dropReason', () => {
  it('the reasons that matter, in words', () => {
    expect(dropReason(15)).toBe('Wrong WiFi password');
    expect(dropReason(204)).toBe('Wrong WiFi password');
    expect(dropReason(201)).toBe('Network not found');
    expect(dropReason(200)).toBe('Signal lost');
    expect(dropReason(8)).toBe('Disconnected (code 8)');
    expect(dropReason(null)).toBeNull();
    expect(dropReason(0)).toBeNull();
  });
});

describe('listStatus', () => {
  it('what each means for the person changing the WiFi', () => {
    expect(listStatus('current', true)).toEqual({ label: 'Has the latest list', tone: 'good' });
    expect(listStatus('waiting', true).label).toBe('Receiving the list…');
    expect(listStatus('waiting', false).label).toBe('Gets it when back online');
    expect(listStatus('update-firmware', true)).toEqual({ label: 'Needs firmware 2.5', tone: 'bad' });
    expect(listStatus('not-set-up', false).label).toBe('Not set up yet');
  });
});

describe('readiness: safe to change the router?', () => {
  it('only when every board that uses the list has the latest one', () => {
    expect(readiness([board({}), board({ list: 'not-set-up' })])).toMatchObject({ total: 2, current: 1, ready: true });
    expect(readiness([board({}), board({ list: 'waiting', online: false })])).toMatchObject({ waiting: 1, ready: false });
    expect(readiness([board({}), board({ list: 'update-firmware' })])).toMatchObject({ needsFirmware: 1, ready: false });
    expect(readiness([]).ready).toBe(false);
  });
});

describe('rescue boxes: which one a board hears, and whether every board hears one', () => {
  it('the box by name (its id when the server knows it), with how strong; none in range is a warning', () => {
    expect(rescueHeard({ heard: 2, box_id: 'rescue-a1b2c3', ssid: 'FloorBeat-Rescue-7f3a-b2c3', rssi: -58 }))
      .toEqual({ label: 'rescue-a1b2c3 · Strong', tone: 'good' });
    expect(rescueHeard({ heard: 1, box_id: null, ssid: 'FloorBeat-Rescue-7f3a-ffff', rssi: -84 }))
      .toEqual({ label: 'FloorBeat-Rescue-7f3a-ffff · Very weak', tone: 'bad' });
    expect(rescueHeard({ heard: 1, box_id: 'rescue-a1b2c3', ssid: 'x', rssi: null })).toEqual({ label: 'rescue-a1b2c3', tone: 'good' });
    expect(rescueHeard({ heard: 0, box_id: null, ssid: null, rssi: null })).toEqual({ label: 'None in range', tone: 'warn' });
    expect(rescueHeard(null)).toEqual({ label: '—', tone: 'neutral' });   // has not looked (older firmware)
  });

  it('coverage counts only the boards that have looked', () => {
    const boards = [
      board({ board_id: 'a', rescue: { heard: 1, box_id: 'r1', ssid: 's', rssi: -60 } }),
      board({ board_id: 'b', rescue: { heard: 0, box_id: null, ssid: null, rssi: null } }),
      board({ board_id: 'c', rescue: null }),
      board({ board_id: 'd' }),
    ];
    expect(rescueCoverage(boards)).toEqual({ looked: 2, covered: 1, uncovered: ['b'] });
    expect(rescueCoverage([])).toEqual({ looked: 0, covered: 0, uncovered: [] });
  });
});

describe('boardsOn / listChanged', () => {
  it('counts online boards on a network', () => {
    expect(boardsOn([board({}), board({ online: false }), board({ ssid: 'Office' })], 'FloorBeat')).toBe(1);
  });

  it('notices any change to the saved list', () => {
    const saved = [{ ssid: 'A', pass: 'password' }];
    expect(listChanged(saved, [{ ssid: 'A', pass: 'password' }])).toBe(false);
    expect(listChanged(saved, [{ ssid: 'A', pass: 'password2' }])).toBe(true);
    expect(listChanged(saved, [])).toBe(true);
  });
});
