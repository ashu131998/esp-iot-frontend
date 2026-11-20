/**
 * A board's WiFi form rendered (server render): its own networks to edit, its factory's by name, where
 * it is now and whether it has its list; read-only with the reason when it cannot be changed; the
 * note for firmware older than 2.9.1.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BoardWifiForm } from '@/components/internal/board-wifi-sheet';
import type { BoardWifi } from '@/lib/board-wifi';

const WIFI: BoardWifi = {
  board_id: 'revb-311d80', factory_id: 'factory-01', networks: [{ ssid: 'DyeRoom-Ext', pass: 'dye-room-1' }],
  factory_networks: [{ ssid: 'Mill' }], max: 8, editable: true, reason: null, status: 'current', cfg_version: 5000,
  online: true, ssid: 'Jio5G_EXT', rssi: -75,
};

// React's server render marks where text meets a value (<!-- -->): left out, the text reads as on screen.
const render = (wifi: BoardWifi, firmware: string | null = '2.9.1-uni') => renderToString(
  <QueryClientProvider client={new QueryClient()}>
    <BoardWifiForm wifi={wifi} firmware={firmware} onClose={() => {}} />
  </QueryClientProvider>,
).replace(/<!-- -->/g, '');

describe('BoardWifiForm', () => {
  it('its own networks to change, its factory\'s by name, where it is and whether it has its list', () => {
    const html = render(WIFI);
    for (const text of ['Its own networks', 'value="DyeRoom-Ext"', 'aria-label="Password 1"', 'type="password"', 'Add a network', 'Remove',
      'Its factory&#x27;s networks', 'Every board of factory-01', 'Mill', 'On Jio5G_EXT · Weak (-75 dBm)', 'Has its list', 'Save and send']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('Jio5G_EXT is not on the list it will have');   // on a network neither list holds
    expect(html).toMatch(/aria-label="Password 1" type="password"/);   // shown only when asked (the eye button)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save and send<\/button>/);   // nothing changed yet
    expect(html).not.toContain('until it is updated to 2.9.1');
  });

  it('a board that cannot take them: the reason, its networks listed, nothing to save', () => {
    const html = render({ ...WIFI, editable: false, reason: 'Claim it first: its WiFi goes to it with its settings.' });
    expect(html).toContain('Claim it first');
    expect(html).toContain('DyeRoom-Ext');
    expect(html).not.toContain('Save and send');
    expect(html).not.toContain('Add a network');
  });

  it('older firmware: says that new settings restart its sensors until it is updated', () => {
    expect(render(WIFI, '2.9.0-uni')).toContain('It runs 2.9.0-uni: until it is updated to 2.9.1 (Update)');
    expect(render(WIFI, null)).toContain('It runs an unknown firmware');
  });

  it('none of its own yet, waiting for it to come back', () => {
    const html = render({ ...WIFI, networks: [], status: 'waiting', online: false, ssid: null, rssi: null });
    expect(html).toContain('None: it uses its factory&#x27;s networks.');
    expect(html).toContain('Not connected now');
    expect(html).toContain('Gets it when back online');
  });
});
