/**
 * The WiFi screens rendered (server render): a board's WiFi as on a phone (the panel the factory's page and
 * ops share) and the factory's simplified WiFi page, as a worker and as an admin, in English and Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BoardWifiView } from '@/components/wifi/board-wifi-panel';
import { WifiManager } from '@/components/wifi/wifi-manager';
import type { BoardWifi } from '@/lib/board-wifi';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';
import type { WifiPage } from '@/lib/wifi';

const NOW = Date.parse('2026-11-20T10:05:00.000Z');
const WIFI: BoardWifi = {
  board_id: 'cam-478998', factory_id: 'factory-01', machines: ['Dye 3'], camera: true, factory_networks: [{ ssid: 'Mill' }],
  saved: [{ ssid: 'Jio5G', own: true, open: false }, { ssid: 'Mill', own: false, open: false }],
  preferred: 'Jio5G', max: 8, room: 6, editable: true, reason: null, can: { connect: true, manage: false },
  status: 'current', cfg_version: 5000, online: true, ssid: 'Jio5G', rssi: -61,
  scans: true, seen: [{ ssid: 'Jio5G', rssi: -61, open: false }, { ssid: 'Mill', rssi: -55, open: false }, { ssid: 'Cafe', rssi: -82, open: true }],
  seen_at: '2026-11-20T10:02:00.000Z', scan_asked: 2, scan_done: 2, attempt: null,
};

// React's server render marks where text meets a value (<!-- -->): left out, the text reads as on screen.
function render(node: ReactNode, seed: (c: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient();
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
}
const panel = (w: BoardWifi, messages: Record<string, string> | null = null) =>
  render(<BoardWifiView scope={{ factoryId: 'factory-01' }} wifi={w} nowMs={NOW} />, () => {}, messages);

describe('a board\'s WiFi as on a phone', () => {
  it('where it is, the networks it sees (the one it is on first), saved ones marked, when it last looked', () => {
    const html = panel(WIFI);
    for (const text of ['Connected to Jio5G', 'Good signal', 'Networks it can see', 'Seen 3 min ago', 'Scan', 'Saved networks',
      'This board only', 'Whole factory', 'Connected', 'Saved']) {
      expect(html).toContain(text);
    }
    expect(html.indexOf('>Jio5G<')).toBeLessThan(html.indexOf('>Mill<'));   // the one it is on, first
    expect(html.indexOf('>Mill<')).toBeLessThan(html.indexOf('>Cafe<'));    // then by signal
    expect(html).not.toContain('Add a network');   // a worker: no adding, no forgetting
    expect(html).not.toContain('Forget');
  });

  it('its admins also add networks and forget its own', () => {
    const html = panel({ ...WIFI, can: { connect: true, manage: true } });
    expect(html).toContain('Add a network');
    expect(html.match(/Forget/g)).toHaveLength(1);   // its own only: the factory's are changed for every board
  });

  it('scanning, connecting, waiting for it, and a connect that failed with Retry or a new password', () => {
    expect(panel({ ...WIFI, scan_asked: 3 })).toContain('Scanning…');
    expect(panel({ ...WIFI, attempt: { ssid: 'Mill', state: 'trying', reason: null } })).toContain('Connecting to Mill… Its readings are kept meanwhile.');
    expect(panel({ ...WIFI, online: false, attempt: { ssid: 'Mill', state: 'trying', reason: null } })).toContain('It connects to Mill when it is back online');
    const refused = panel({ ...WIFI, attempt: { ssid: 'Mill', state: 'failed', reason: 250 } });
    expect(refused).toContain('Could not connect to Mill');
    expect(refused).toContain('No internet through it');
    expect(refused).toContain('It went back to a network that works.');
    expect(refused).toContain('Retry');
    const wrong = panel({ ...WIFI, attempt: { ssid: 'Jio5G', state: 'failed', reason: 15 } });
    expect(wrong).toContain('Wrong WiFi password');
    expect(wrong).toContain('aria-label="The right password"');
  });

  it('off air, older firmware, and a board that cannot take WiFi: says so, nothing to press', () => {
    const off = panel({ ...WIFI, online: false, scan_asked: 3 });
    expect(off).toContain('Offline');
    expect(off).toContain('Last on Jio5G');
    expect(off).toContain('It scans when it is back online');
    expect(panel({ ...WIFI, scans: false })).toContain('Update its firmware to 2.9.4 to see the networks around it.');
    const box = panel({ ...WIFI, editable: false, reason: 'Claim it first: its WiFi goes to it with its settings.', can: { connect: false, manage: false } });
    expect(box).toContain('Claim it first');
    expect(box).not.toMatch(/>Scan</);
    expect(panel({ ...WIFI, seen: [], online: false, ssid: null })).toContain('It has not connected yet');
  });

  it('in Hindi', () => {
    const html = panel({ ...WIFI, attempt: { ssid: 'Mill', state: 'failed', reason: 15 } }, hi);
    expect(html).toContain(hi['Networks it can see']);
    expect(html).toContain(hi['Wrong WiFi password']);
    expect(html).toContain('Jio5G');   // names stay as they are
  });
});

const PAGE: WifiPage = {
  factory_id: 'factory-01', networks: [{ ssid: 'Mill', pass: 'mill-pass-1' }], version: 4000,
  rescue: { ssid_prefix: 'FloorBeat-Rescue-7f3a-', password: 'abcd-efgh-jkmn-pqrs' },
  boards: [
    { board_id: 'revb-311d80', line_id: 'line-1', online: true, last_beat_at: null, ssid: 'Mill', rssi: -58, last_drop: null,
      firmware: '2.9.4-uni', list: 'current', machines: ['Machine 1', 'Machine 2'] },
    { board_id: 'cam-478998', line_id: 'line-1', online: false, last_beat_at: null, ssid: 'Jio5G', rssi: null, last_drop: null,
      firmware: '2.9.4-cam', list: 'waiting', machines: [] },
  ],
  boxes: [], managed: true, can_edit: true,
};
const page = (p: WifiPage, messages: Record<string, string> | null = null) =>
  render(<WifiManager factoryId="factory-01" />, (c) => c.setQueryData(['factory-wifi', 'factory-01'], p), messages);

describe('the factory\'s WiFi page, kept simple', () => {
  it('an admin: who is offline, each board by its machines, the saved networks with their passwords, the router steps', () => {
    const html = page(PAGE);
    for (const text of ['1 of 2 boards online', 'Offline: cam-478998', 'Machine 1, Machine 2', 'Mill · Strong signal',
      'Offline · last on Jio5G', 'Getting the new list', 'Saved networks', 'Show password', 'Add network', 'Changing your router?', 'Rescue boxes (0)']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('1 board still to receive it');
  });

  it('a worker: the same boards; the networks by name only; no router steps, no rescue boxes, no password anywhere', () => {
    const html = page({ ...PAGE, networks: [{ ssid: 'Mill', open: false }], rescue: null, can_edit: false });
    expect(html).toContain('Machine 1, Machine 2');
    expect(html).toContain('Only the factory&#x27;s admins can change these.');
    for (const text of ['Show password', 'Add network', 'Changing your router?', 'Rescue boxes', 'mill-pass-1', 'abcd-efgh']) {
      expect(html).not.toContain(text);
    }
  });

  it('every board online; none yet; in Hindi', () => {
    expect(page({ ...PAGE, boards: [PAGE.boards[0]] })).toContain('The board is online');
    expect(page({ ...PAGE, boards: [PAGE.boards[0], { ...PAGE.boards[0], board_id: 'revb-2' }] })).toContain('All 2 boards are online');
    expect(page({ ...PAGE, boards: [] })).toContain('No boards in this factory yet');
    expect(page(PAGE, hi)).toContain(hi['Saved networks']);
  });
});
