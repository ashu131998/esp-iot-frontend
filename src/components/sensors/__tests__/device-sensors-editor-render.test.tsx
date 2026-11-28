/**
 * The one sensor editor of the Boards page, the Nodes page and the factory's Sensor mapping (2026-11-27),
 * rendered with a node's detail (server render): the same rows for everyone; what each person may change
 * (our super admin: what is fitted on the board too; a factory's admins: names, machines, on thresholds;
 * anyone else: nothing); nothing to save until something changed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { SensorsDetail } from '@/lib/board-sensors';
import type { NodeDetailResponse } from '@/lib/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const { DeviceSensorsEditor } = await import('@/components/sensors/device-sensors-editor');

const SENSORS: SensorsDetail = {
  version: 'v1',
  board: { board_id: 'revb-1', managed: true, thresholds: { on_amps: 0.12, confirm_samples: 5 }, firmware: '2.9.4' },
  rows: [
    { slot: 'I1', sensor_type: 'current', board: true, name: 'Loom 1 motor', machine_id: 'm1', on_threshold_a: 0.5, enabled: true, cal: 30, binding_id: 'sb-1' },
    { slot: 'P1', sensor_type: 'cycle', board: true, name: 'P1', machine_id: null, on_threshold_a: null, enabled: true, debounce_us: 10000, binding_id: null },
    { slot: 'M1', sensor_type: 'vibration', board: false, name: 'Bearing', machine_id: 'm2', on_threshold_a: null, enabled: true, binding_id: 'sb-2' },
  ],
};
const detail = (sensors: SensorsDetail | null = SENSORS): NodeDetailResponse => ({
  device: { device_id: 'revb-1', factory_id: 'mill', line_id: 'line-1', device_type: 'current', last_seen_at: null },
  bindings: [],
  discovered_channels: [],
  machines: [{ machine_id: 'm1', name: 'Loom 1', line_id: 'line-1' }, { machine_id: 'm2', name: 'Loom 2', line_id: 'line-1' }],
  sensors,
});

function render(props: { canWrite: boolean; canHardware: boolean; mode?: 'admin' | 'factory' }, data: NodeDetailResponse = detail()) {
  const mode = props.mode ?? 'factory';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['node-detail', mode, 'mill', 'revb-1'], data);
  return renderToString(
    <QueryClientProvider client={client}>
      <DeviceSensorsEditor factoryId="mill" deviceId="revb-1" mode={mode} canWrite={props.canWrite} canHardware={props.canHardware} />
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
}

const input = (html: string, label: string) => html.match(new RegExp(`<(input|select)[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? null;

describe('the one list', () => {
  it('every row as the server joined them: the board\'s channels with their machines, then the other links', () => {
    const html = render({ canWrite: true, canHardware: false });
    for (const text of ['I1', 'Current (CT)', 'Loom 1 motor', 'P1', 'Proximity (count)', 'M1', 'Vibration', 'Bearing']) expect(html).toContain(text);
    expect(html.indexOf('Loom 1 motor')).toBeLessThan(html.indexOf('Bearing'));
    expect(html).toContain('Board revb-1 · firmware 2.9.4');
    // the machine each one measures, picked
    expect(html).toMatch(/aria-label="I1 machine"[\s\S]*?<option value="m1" selected="">Loom 1 \(Line 1\)<\/option>/);
  });

  it('nothing to save until something changes', () => {
    const html = render({ canWrite: true, canHardware: true, mode: 'admin' });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/);
    expect(html).not.toContain('Discard changes');
  });
});

describe('who may change what', () => {
  it('our super admin: what is fitted on the board too (calibration, debounce, the board-wide thresholds, its free slots)', () => {
    const html = render({ canWrite: true, canHardware: true, mode: 'admin' });
    expect(input(html, 'I1 calibration')).not.toBeNull();
    expect(input(html, 'P1 debounce')).not.toBeNull();
    expect(html).toContain('Machine on above (A), board-wide');
    expect(html).toContain('<option value="board:I2">I2 · Current (CT)</option>');
    expect((html.match(/>Remove</g) ?? []).length).toBe(3);   // a board channel too
  });

  it('a factory\'s admins: names, machines and on thresholds; the board\'s calibration shown, not changed; no channels added', () => {
    const html = render({ canWrite: true, canHardware: false });
    expect(input(html, 'I1 name')).not.toMatch(/disabled/);
    expect(input(html, 'I1 machine')).not.toMatch(/disabled/);
    expect(input(html, 'I1 on threshold')).not.toMatch(/disabled/);
    expect(input(html, 'I1 calibration')).toBeNull();
    expect(html).toContain('>30<');                // its calibration, as text
    expect(html).not.toContain('board-wide');
    expect(html).not.toContain('value="board:');
    expect(html).toContain('value="modbus:M2:vibration"');   // a Modbus sensor, a link only
    expect((html.match(/>Remove</g) ?? []).length).toBe(1);   // the Modbus link only
  });

  it('anyone else: the list, nothing to change', () => {
    const html = render({ canWrite: false, canHardware: false });
    expect(input(html, 'I1 name')).toMatch(/disabled/);
    expect(input(html, 'I1 machine')).toMatch(/disabled/);
    expect(html).not.toContain('>Save<');
    expect(html).not.toContain('Add a sensor');
  });
});

describe('boards and servers of other kinds', () => {
  it('a board never set from the dashboard: said so; its channels not changed here', () => {
    const unmanaged = { ...SENSORS, board: { ...SENSORS.board!, managed: false } };
    const html = render({ canWrite: true, canHardware: true, mode: 'admin' }, detail(unmanaged));
    expect(html).toContain('never set from FloorBeat');
    expect(input(html, 'I1 calibration')).toBeNull();
    expect(html).not.toContain('board-wide');
  });

  it('a server from before the one list: said so, nothing to edit', () => {
    const html = render({ canWrite: true, canHardware: true }, detail(null));
    expect(html).toContain('does not list sensors this way yet');
    expect(html).not.toContain('>Save<');
  });
});
