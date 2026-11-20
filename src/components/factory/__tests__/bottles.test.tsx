/**
 * The Bottles page rendered with sample data (server render): the sentence, each camera with its
 * picture, the boxes over it and a bar per bottle, the changes with their pictures; the editor's
 * bottle list and machine; the empty states; Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { bottleEventsQueryKey, bottlesQueryKey, type BottleCamera, type BottlesResponse, type LevelEvent } from '@/lib/bottles';
import { FactoryRefsProvider } from '@/lib/factory-refs-context';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';

const auth = { canWriteFactory: true, isInternalStaff: false };
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));

const { BottlesOverview, PictureWithBoxes } = await import('@/components/factory/bottles-dashboard');
const { BottleBoxForm } = await import('@/components/factory/bottle-box-editor');

const F = 'mill-01';
const CAM = 'cam-a1b2c3';
const SETTINGS = {
  ref_w: 640, ref_h: 480, period_s: 5, need: 3, hyst: 5, dark: 110, bright: 150, exposure: -1, gain: -1,
  flip: false, mirror: false, quality: 12, pic_every_s: 600, snap: 2,
};
const camera: BottleCamera = {
  board_id: CAM, line_id: 'line-2', machine_id: 'm1', machine_name: 'Loom 3', online: true,
  last_beat_at: '2026-11-17T10:00:05.000Z', camera: 'ok', fw: '2.9.0-cam', cfg_version: 5000, settings: SETTINGS,
  bottles: [
    { slot: 'B1', name: 'Red', low: 15, cap: 20, box: { x: 100, y: 40, w: 80, h: 360 }, state: 'ok', percent: 72, present: true, at: '2026-11-17T10:00:00.000Z' },
    { slot: 'B2', name: 'Blue', low: 15, cap: 20, box: { x: 300, y: 40, w: 80, h: 360 }, state: 'low', percent: 12, present: true, at: '2026-11-17T10:00:00.000Z' },
  ],
  last_picture: { id: 42, kind: 'periodic', slot: null, state: null, percent: null, ev: null, taken_at: '2026-11-17T09:58:00.000Z', width: 640, height: 480, bytes: 41000 },
};
const events: LevelEvent[] = [
  { id: 9, slot: 'B2', name: 'Blue', state: 'low', prev: 'ok', percent: 12, present: true, low: 15, ev: 77, occurred_at: '2026-11-17T09:57:00.000Z', picture_id: 41 },
  { id: 8, slot: 'B1', name: 'Red', state: 'ok', prev: 'missing', percent: 80, present: true, low: 15, ev: 70, occurred_at: '2026-11-16T15:00:00.000Z', picture_id: null },
];
const refs = {
  machines: [
    { machine_id: 'm1', name: 'Loom 3', line_id: 'line-2' },
    { machine_id: 'm2', name: 'Loom 10', line_id: 'line-2' },
  ],
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
const seed = (cameras: BottleCamera[] = [camera]) => (c: QueryClient) => {
  c.setQueryData<BottlesResponse>(bottlesQueryKey(F), { cameras });
  c.setQueryData(bottleEventsQueryKey(F, CAM), { events });
};

describe('the Bottles page', () => {
  it('the sentence, the camera by its machine and line, its picture with the boxes, a bar per bottle', () => {
    const html = render(<BottlesOverview factoryId={F} />, seed());
    expect(html).toContain('1 bottle needs a refill');
    expect(html).toContain('Blue: refill before the colour runs out.');
    expect(html).toContain('Dye camera at Loom 3');
    expect(html).toContain('Press shop · Online');
    expect(html).toContain(`src="/api/v1/factories/${F}/bottles/${CAM}/pictures/42"`);
    expect(html).toContain('Routine picture');
    expect(html).toContain('left:15.63%;top:8.33%;width:12.50%;height:75.00%');   // Red's box, as a share of the picture
    expect(html).toContain('72%');
    expect(html).toContain('Low: 12% left, refill it');
    expect(html).toContain('width:12%');                                           // Blue's bar
    expect(html).toContain('Bottles &amp; settings');
    expect(html).toContain('Take a picture');
    expect(html).toContain('Watch live');
  });

  it('the changes with their pictures, newest first', () => {
    const html = render(<BottlesOverview factoryId={F} />, seed());
    expect(html).toContain('Changes · Dye camera at Loom 3');
    expect(html).toContain('Blue: low, 12% left');
    expect(html).toContain('Red: bottle back, 80%');
    expect(html).toContain(`href="/api/v1/factories/${F}/bottles/${CAM}/pictures/41"`);
    expect(html.indexOf('Blue: low')).toBeLessThan(html.indexOf('Red: bottle back'));
  });

  it('a viewer reads but cannot change anything', () => {
    auth.canWriteFactory = false;
    try {
      const html = render(<BottlesOverview factoryId={F} />, seed());
      expect(html).toContain('Dye camera at Loom 3');
      expect(html).not.toContain('Bottles &amp; settings');
      expect(html).not.toContain('Take a picture');
      expect(html).toContain('Watch live');   // the live view is for everyone who sees the page
    } finally {
      auth.canWriteFactory = true;
    }
  });

  it('no camera yet: the steps; a camera with nothing drawn: what to do; a camera at no machine: the hint', () => {
    const none = render(<BottlesOverview factoryId={F} />, seed([]));
    expect(none).toContain('No dye camera yet');
    expect(none).toContain('Setting up a dye camera');
    const blank = render(<BottlesOverview factoryId={F} />, seed([{ ...camera, bottles: [], machine_id: null, machine_name: null, last_picture: null }]));
    expect(blank).toContain('Draw a box around each bottle to start');
    expect(blank).toContain('Dye camera cam-a1b2c3');
    expect(blank).toContain('No bottles drawn yet');
    expect(blank).toContain('No picture yet: ask for one with Take a picture.');
    const unplaced = render(<BottlesOverview factoryId={F} />, seed([{ ...camera, machine_id: null, machine_name: null }]));
    expect(unplaced).toContain('At no machine yet');
  });

  it('an offline camera says since when; a camera fault is shown', () => {
    const off = render(<BottlesOverview factoryId={F} />, seed([{ ...camera, online: false }]));
    expect(off).toMatch(/Offline since 17 Nov/);
    const fault = render(<BottlesOverview factoryId={F} />, seed([{ ...camera, camera: 'probe' }]));
    expect(fault).toContain('The camera module reports a fault: probe.');
  });

  it('in Hindi', () => {
    const html = render(<BottlesOverview factoryId={F} />, seed([{ ...camera, bottles: [camera.bottles[0]] }]), hi);
    expect(html).toContain(hi['Every dye bottle is topped up']);
    expect(html).not.toContain('Every dye bottle is topped up');
    expect(html).toContain('Loom 3');
  });
});

describe('the picture with its boxes', () => {
  it('each box sits where the bottle is, coloured by its state', () => {
    const html = render(<PictureWithBoxes factoryId={F} camera={camera} />);
    expect(html).toContain('border-emerald-400');
    expect(html).toContain('border-amber-400');
    expect(html).toContain('>Red<');
    expect(html).toContain('>Blue<');
  });
});

describe('the editor', () => {
  it('lists each bottle with its name and refill line, the machine, and the camera settings', () => {
    const html = render(<BottleBoxForm factoryId={F} camera={camera} onClose={() => {}} />);
    expect(html).toContain('value="Red"');
    expect(html).toContain('value="Blue"');
    expect(html).toContain('value="15"');
    expect(html).toContain('<option value="m1" selected="">Loom 3</option>');
    expect(html.indexOf('>Loom 3<')).toBeLessThan(html.indexOf('>Loom 10<'));
    expect(html).toContain('Camera settings');
    expect(html).toContain('Send to camera');
    expect(html).toContain(`src="/api/v1/factories/${F}/bottles/${CAM}/pictures/42"`);
  });

  it('without a picture, asks for one first', () => {
    const html = render(<BottleBoxForm factoryId={F} camera={{ ...camera, last_picture: null, bottles: [], machine_id: null, machine_name: null }} onClose={() => {}} />);
    expect(html).toContain('Ask the camera for a picture to draw on.');
    expect(html).toContain('<option value="" selected="">');
  });
});
