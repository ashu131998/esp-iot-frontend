import { describe, expect, it } from 'vitest';

import {
  chosen, cleanOwn, currentNetwork, keepsMeasuring, networkChoices, ownChanged, ownProblems, roomLeft, sentStatus, switchesNetworks,
  totalNetworks, wifiChanged,
} from '@/lib/board-wifi';

const factory = [{ ssid: 'Mill' }, { ssid: 'Office' }];
const n = (i: number) => ({ ssid: `Net-${i}`, pass: `password-${i}` });

describe('a board\'s own WiFi networks', () => {
  it('counts its own and its factory\'s under other names; the room left of 8', () => {
    expect(totalNetworks([], factory)).toBe(2);
    expect(totalNetworks([n(1)], factory)).toBe(3);
    expect(totalNetworks([{ ssid: 'Office', pass: 'its-own-pass' }], factory)).toBe(2);   // the same name: counted once
    expect(totalNetworks([{ ssid: ' Office ', pass: 'its-own-pass' }], factory)).toBe(2);   // as the server trims it
    expect(roomLeft([n(1)], factory, 8)).toBe(5);
    expect(roomLeft([1, 2, 3, 4, 5, 6, 7].map(n), factory, 8)).toBe(0);
  });

  it('each row\'s problem as the server would say it; too many in all', () => {
    const p = ownProblems([n(1), { ssid: '', pass: '' }, { ssid: 'X', pass: 'short' }, n(1)], factory, 8);
    expect(p.rows).toEqual([null, 'Enter the WiFi name', 'A WiFi password has 8–63 characters', 'Net-1 is already in the list']);
    expect(p.list).toBeNull();
    expect(ownProblems([1, 2, 3, 4, 5, 6, 7].map(n), factory, 8).list).toBe('At most 8 networks in all: its factory has 2, so at most 6 of its own');
    expect(ownProblems([], factory, 8)).toEqual({ rows: [], list: null });
    expect(ownProblems([{ ssid: 'Open-Net', pass: '' }], factory, 8).rows).toEqual([null]);   // an open network
  });

  it('kept trimmed; changed only when something differs', () => {
    expect(cleanOwn([{ ssid: '  Dye  ', pass: ' p a s s 1 ' }])).toEqual([{ ssid: 'Dye', pass: ' p a s s 1 ' }]);
    expect(ownChanged([n(1)], [n(1)])).toBe(false);
    expect(ownChanged([n(1)], [{ ...n(1), ssid: ' Net-1 ' }])).toBe(false);
    expect(ownChanged([n(1)], [{ ...n(1), pass: 'other-pass' }])).toBe(true);
    expect(ownChanged([n(1)], [])).toBe(true);
    expect(ownChanged([n(1), n(2)], [n(2), n(1)])).toBe(true);
  });

  it('whether it has what was sent, in words', () => {
    expect(sentStatus({ status: 'current', online: true })).toMatchObject({ label: 'Has its list', tone: 'good' });
    expect(sentStatus({ status: 'waiting', online: true })).toMatchObject({ label: 'Receiving it…', tone: 'warn' });
    expect(sentStatus({ status: 'waiting', online: false })).toMatchObject({ label: 'Gets it when back online', tone: 'warn' });
    expect(sentStatus({ status: 'update-firmware', online: true })).toMatchObject({ label: 'Needs firmware 2.5', tone: 'bad' });
    expect(sentStatus({ status: 'not-set-up', online: false })).toMatchObject({ label: 'Not set up yet', tone: 'neutral' });
  });

  it('keeps measuring through new settings from 2.9.1', () => {
    expect(keepsMeasuring('2.9.1-uni')).toBe(true);
    expect(keepsMeasuring('2.10.0-cam')).toBe(true);
    expect(keepsMeasuring('3.0.0-base')).toBe(true);
    expect(keepsMeasuring('2.9.0-uni')).toBe(false);
    expect(keepsMeasuring('2.8.9')).toBe(false);
    expect(keepsMeasuring(null)).toBe(false);
    expect(keepsMeasuring('dev')).toBe(false);
  });

  it('the network it is on now, and whether the list it will have still holds it', () => {
    const w = { online: true, ssid: 'Mill', rssi: -61, factory_networks: factory };
    expect(currentNetwork(w, [])).toEqual({ label: 'On Mill · Good (-61 dBm)', onList: true, tone: 'good' });
    expect(currentNetwork({ ...w, ssid: 'DyeRoom-Ext' }, [{ ssid: 'DyeRoom-Ext', pass: 'dye-room-1' }]).onList).toBe(true);
    expect(currentNetwork({ ...w, ssid: 'Jio5G_EXT', rssi: -86 }, [])).toEqual({ label: 'On Jio5G_EXT · Very weak (-86 dBm)', onList: false, tone: 'bad' });
    expect(currentNetwork({ ...w, rssi: null }, []).label).toBe('On Mill');
    expect(currentNetwork({ ...w, online: false }, [])).toEqual({ label: 'Not connected now', onList: null, tone: 'neutral' });
  });
});

describe('the network a board should use', () => {
  const own = [{ ssid: 'Jio5G', pass: 'jio-pass-1' }, { ssid: ' DyeRoom ', pass: 'dye-pass-1' }, { ssid: '', pass: '' }];

  it('its own (as typed, named, once) then its factory\'s', () => {
    expect(networkChoices(own, [{ ssid: 'Mill' }, { ssid: 'Jio5G' }])).toEqual(['Jio5G', 'DyeRoom', 'Mill']);
    expect(networkChoices([], [])).toEqual([]);
  });

  it('a choice stands while that network is on the list', () => {
    expect(chosen('Jio5G', own, [])).toBe('Jio5G');
    expect(chosen('Mill', own, [{ ssid: 'Mill' }])).toBe('Mill');
    expect(chosen('Jio5G', [], [{ ssid: 'Mill' }])).toBeNull();   // removed in the form
    expect(chosen(null, own, [])).toBeNull();
  });

  it('something to save: its own networks or the choice changed', () => {
    const saved = { networks: [{ ssid: 'Jio5G', pass: 'jio-pass-1' }], preferred: null };
    expect(wifiChanged(saved, [{ ssid: 'Jio5G', pass: 'jio-pass-1' }], null)).toBe(false);
    expect(wifiChanged(saved, [{ ssid: 'Jio5G', pass: 'jio-pass-1' }], 'Jio5G')).toBe(true);
    expect(wifiChanged({ ...saved, preferred: 'Jio5G' }, [{ ssid: 'Jio5G', pass: 'jio-pass-1' }], null)).toBe(true);
    expect(wifiChanged(saved, [], null)).toBe(true);
  });

  it('moves to it from firmware 2.9.2', () => {
    expect(switchesNetworks('2.9.2-cam')).toBe(true);
    expect(switchesNetworks('2.10.0-uni')).toBe(true);
    expect(switchesNetworks('2.9.1-uni')).toBe(false);
    expect(switchesNetworks(undefined)).toBe(false);
  });
});
