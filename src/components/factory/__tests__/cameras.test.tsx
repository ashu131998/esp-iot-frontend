/**
 * The Cameras page rendered with sample data (server render): the sentence, each camera with its last picture, Watch
 * live for everyone, a picture now and its settings for admins, something in front of it now, what it saw with the
 * pictures; the settings pop-up; the empty states; Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { cameraEventsQueryKey, camerasQueryKey, type Camera, type CameraEvent, type CamerasResponse } from '@/lib/cameras';
import { FactoryRefsProvider } from '@/lib/factory-refs-context';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';

const auth = { canWriteFactory: true, isInternalStaff: false };
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));

const { CamerasOverview } = await import('@/components/factory/cameras-dashboard');
const { CameraSettingsForm } = await import('@/components/factory/camera-settings');

const F = 'mill-01';
const CAM = 'cam-a1b2c3';
const camera: Camera = {
  board_id: CAM, line_id: 'line-2', machine_id: 'm1', machine_name: 'Loom 3', online: true, last_beat_at: '2026-11-20T10:00:05.000Z',
  camera: 'ok', view: 'clear', fw: '2.9.6-cam', cfg_version: 5000, view_alert: true,
  settings: { exposure: -1, gain: -1, flip: false, mirror: false, pic_every_s: 600, snap: 2 },
  last_picture: { id: 42, kind: 'periodic', slot: null, state: null, ev: null, taken_at: '2026-11-20T09:58:00.000Z', width: 640, height: 480, bytes: 41000 },
};
const events: CameraEvent[] = [
  { id: 9, slot: 'V', state: 'ok', prev: 'blocked', ev: null, occurred_at: '2026-11-20T09:57:10.000Z', picture_id: null },
  { id: 8, slot: 'V', state: 'blocked', prev: 'ok', ev: 77, occurred_at: '2026-11-20T09:57:00.000Z', picture_id: 41 },
];
const refs = {
  machines: [{ machine_id: 'm1', name: 'Loom 3', line_id: 'line-2' }, { machine_id: 'm2', name: 'Loom 10', line_id: 'line-2' }],
  lines: [{ factory_id: F, line_id: 'line-2', name: 'Press shop' }],
  minDate: null, maxDate: null, shifts: [], display: {},
} as never;

function render(node: ReactNode, seed: (client: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>
        <FactoryRefsProvider value={refs}>{node}</FactoryRefsProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '');
}
const seed = (cameras: Camera[] = [camera]) => (c: QueryClient) => {
  c.setQueryData<CamerasResponse>(camerasQueryKey(F), { cameras });
  c.setQueryData(cameraEventsQueryKey(F, CAM), { events });
};

describe('the Cameras page', () => {
  it('the sentence, the camera by its machine and line, its last picture, Watch live, a picture now and its settings', () => {
    const html = render(<CamerasOverview factoryId={F} />, seed());
    for (const text of ['The camera is on', 'Camera at Loom 3', 'Press shop · Online', 'Watch live', 'Take a picture', 'Settings',
      `/api/v1/factories/${F}/cameras/${CAM}/pictures/42`, 'Routine picture', 'What it saw · Camera at Loom 3']) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/[Bb]ottle/);
  });

  it('what it saw: something in front of it with its picture, clear again', () => {
    const html = render(<CamerasOverview factoryId={F} />, seed());
    expect(html).toContain('Something in front of the camera');
    expect(html).toContain('The view is clear again');
    expect(html).toContain(`/cameras/${CAM}/pictures/41`);
  });

  it('a worker watches live but asks for no picture and changes nothing', () => {
    auth.canWriteFactory = false;
    try {
      const html = render(<CamerasOverview factoryId={F} />, seed());
      expect(html).toContain('Watch live');
      expect(html).not.toContain('Take a picture');
      expect(html).not.toContain('>Settings<');
    } finally {
      auth.canWriteFactory = true;
    }
  });

  it('something in front of it now: said at the top and on the camera; its alert switched off: said too', () => {
    const html = render(<CamerasOverview factoryId={F} />, seed([{ ...camera, view: 'blocked', view_alert: false }]));
    expect(html).toContain('Something is in front of 1 camera');
    expect(html).toContain('Camera at Loom 3: check that nobody is blocking it.');
    expect(html).toContain('Something is in front of the camera right now.');
    expect(html).toContain('Its alert is switched off');
  });

  it('no camera yet; an offline camera with no picture; a camera module fault', () => {
    expect(render(<CamerasOverview factoryId={F} />, seed([]))).toContain('No camera yet');
    const off = render(<CamerasOverview factoryId={F} />, seed([{ ...camera, online: false, last_picture: null, machine_name: null }]));
    expect(off).toContain('1 camera is offline');
    expect(off).toContain(`Camera ${CAM}: check its power and WiFi.`);
    expect(off).toContain('No picture yet.');
    expect(render(<CamerasOverview factoryId={F} />, seed([{ ...camera, camera: 'init failed' }]))).toContain('The camera module reports a fault: init failed.');
  });

  it('in Hindi', () => {
    const html = render(<CamerasOverview factoryId={F} />, seed(), hi);
    expect(html).toContain(hi['Watch live']);
    expect(html).toContain(hi['The camera is on']);
  });
});

describe('a camera\'s settings', () => {
  it('the alert switch (on), the machine it is at, how often a picture, how it is mounted', () => {
    const html = render(<CameraSettingsForm factoryId={F} camera={camera} onClose={() => {}} />);
    expect(html).toMatch(/<input type="checkbox" class="mt-1" checked=""\/>/);   // the alert, on
    expect(html).toContain('Alert when something is in front of the camera');
    expect(html).toMatch(/<option value="m1" selected="">Loom 3<\/option>/);
    expect(html).toContain('Loom 10');
    expect(html).toMatch(/<option value="600" selected="">Every 10 minutes<\/option>/);
    expect(html).toContain('Only when something happens or I ask');
    expect(html).toContain('Upside down');
    expect(html).toContain('Mirrored');
  });

  it('switched off, an interval not among the choices: shown as they are', () => {
    const html = render(<CameraSettingsForm factoryId={F} camera={{ ...camera, view_alert: false, settings: { ...camera.settings, pic_every_s: 120 } }} onClose={() => {}} />);
    expect(html).toMatch(/<input type="checkbox" class="mt-1"\/>/);
    expect(html).toMatch(/<option value="120" selected="">Every 2 minutes<\/option>/);
  });
});
