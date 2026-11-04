/**
 * The temperature / vibration page and the period pies rendered with sample data (server render,
 * no browser or backend): what a factory sees, in English and in Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FactoryRefsProvider } from '@/lib/factory-refs-context';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';
import type { AvailabilityResponse, EnergyResponse, SensorFiguresResponse } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/factories/mill-01/temperature',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}));

const { SensorDashboard } = await import('@/components/factory/sensor-dashboard');
const { AvailabilitySplit, EnergySplit, OverviewRunSplit } = await import('@/components/factory/period-splits');

const F = 'mill-01';
const series = (values: number[]): [string, number][] => values.map((v, i) => [new Date(Date.UTC(2026, 10, 4, 6, i)).toISOString(), v]);
const fig = (key: string, latest: number, values: number[]) => ({
  key, latest, latest_at: '2026-11-04T06:30:00.000Z', avg: values.reduce((s, v) => s + v, 0) / values.length,
  min: Math.min(...values), max: Math.max(...values), samples: values.length, series: series(values),
});

const temperature: SensorFiguresResponse = {
  factory_id: F, kind: 'temperature', from: '2026-11-04T00:00:00.000Z', to: '2026-11-04T07:00:00.000Z', source: 'minute', bucket_s: 60,
  machines: [
    { machine_id: 'm1', machine_name: 'Mixer 1', line_id: 'line-1', status: 'ok', value: 83.4, band: 'hot', sensors: [{ device_id: 'revb-1', slot: 'T1', label: 'Motor', figures: [fig('celsius', 83.4, [70, 83.4])] }] },
    { machine_id: 'm2', machine_name: 'Press 2', line_id: 'line-2', status: 'ok', value: 41, band: 'normal', sensors: [{ device_id: 'revb-1', slot: 'T2', label: 'Oil', figures: [fig('celsius', 41, [40, 41])] }] },
    { machine_id: 'm3', machine_name: 'Press 3', line_id: 'line-2', status: 'no_sensor', value: null, band: null, sensors: [] },
  ],
  unbound: [{ device_id: 'revb-2', slot: 'T1', name: 'T1', figures: [fig('celsius', 25, [25])] }],
  summary: { machines: 3, with_sensor: 2, reporting: 2, bands: { normal: 1, warm: 0, hot: 1, unknown: 0 } },
};

const refs = {
  machines: [], lines: [{ factory_id: F, line_id: 'line-1', name: 'Weaving A' }, { factory_id: F, line_id: 'line-2', name: 'Press shop' }],
  minDate: null, maxDate: null, shifts: [], display: {},
} as never;

function render(node: ReactNode, seed: (client: QueryClient) => void, messages: Record<string, string> | null = null) {
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

describe('the temperature page', () => {
  const seed = (data: SensorFiguresResponse) => (c: QueryClient) => c.setQueryData(['sensor-figures', data.kind, F, 'live', 'live', '', ''], data);

  it('says what matters first, splits the machines by band, lists them hottest first with line names', () => {
    const html = render(<SensorDashboard factoryId={F} kind="temperature" />, seed(temperature));
    expect(html).toContain('1 machine runs hot');
    expect(html).toContain('2 of 2 machines with a sensor are reporting');
    expect(html).toContain('Machines by temperature');
    expect(html).toContain('Now: normal up to 60 °C, warm up to 80 °C, hot above');
    expect(html).toMatch(/Hot<\/span>.*?1 machine/);
    expect(html.indexOf('Mixer 1')).toBeLessThan(html.indexOf('Press 2'));
    expect(html).toContain('Weaving A');
    expect(html).not.toContain('>line-1<');
    expect(html).toContain('83.4 °C');
    expect(html).toContain('1 machine has no sensor of this kind');
    expect(html).toContain('Readings from sensors not matched to a machine yet: T1 (25 °C)');
    expect(html).toContain('lucide-thermometer');   // a warning sign, never a check mark, when a machine runs hot
    expect(html).toContain('/factories/mill-01/sensor-mapping');
  });

  it('no sensors yet: a plain sentence, no pie', () => {
    const none: SensorFiguresResponse = { ...temperature, machines: [temperature.machines[2]], unbound: [], summary: { machines: 1, with_sensor: 0, reporting: 0, bands: { normal: 0, warm: 0, hot: 0, unknown: 0 } } };
    const html = render(<SensorDashboard factoryId={F} kind="temperature" />, seed(none));
    expect(html).toContain('No machine has a temperature sensor yet');
    expect(html).not.toContain('Machines by temperature');
    expect(html).toContain('No machine has a sensor of this kind yet.');
  });

  it('vibration in Hindi: zones, not bands', () => {
    const vibration: SensorFiguresResponse = {
      ...temperature, kind: 'vibration', unbound: [],
      machines: [{ machine_id: 'm1', machine_name: 'Mixer 1', line_id: 'line-1', status: 'ok', value: 3.1, zone: 'warning', sensors: [{ device_id: 'b', slot: 'M1', figures: [fig('vel_x', 3.1, [2, 3.1])] }] }],
      summary: { machines: 1, with_sensor: 1, reporting: 1, zones: { good: 0, warning: 1, alarm: 0, unknown: 0 } },
    };
    const html = render(<SensorDashboard factoryId={F} kind="vibration" />, seed(vibration), hi);
    expect(html).toContain('1 मशीन चेतावनी ज़ोन में कंपन कर रही है');
    expect(html).toContain('कंपन ज़ोन के हिसाब से मशीनें');
    expect(html).toContain('3.1 mm/s');
  });
});

describe('the period pies', () => {
  const availability: AvailabilityResponse = {
    factory_id: F, from: 'a', to: 'b', avg_availability_percent: 70, total_uptime_minutes: 0, total_downtime_minutes: 0,
    machines: [
      { machine_id: 'm1', machine_name: 'Mixer 1', line_id: 'line-1', uptime_minutes: 540, downtime_minutes: 60, availability_percent: 90, status: 'computed' },
      { machine_id: 'm2', machine_name: 'Press 2', line_id: 'line-2', uptime_minutes: 300, downtime_minutes: 300, availability_percent: 50, status: 'computed' },
      { machine_id: 'm3', machine_name: 'Press 3', line_id: 'line-2', uptime_minutes: 0, downtime_minutes: 0, availability_percent: null, status: 'no_data' },
    ],
  };

  it('overview: machines by how much of the period they ran', () => {
    const html = render(<OverviewRunSplit factoryId={F} />, (c) => c.setQueryData(['availability', F, 'live', 'live', '', ''], availability));
    expect(html).toContain('Machines by running time');
    expect(html).toMatch(/Ran 85% or more<\/span><\/span><span[^>]*><span[^>]*>1 machine/);
    expect(html).toMatch(/Ran under 70%<\/span><\/span><span[^>]*><span[^>]*>1 machine/);
    expect(html).toMatch(/No data<\/span><\/span><span[^>]*><span[^>]*>1 machine/);
  });

  it('availability: running against stopped time over the machines shown', () => {
    const html = render(<AvailabilitySplit factoryId={F} />, (c) => c.setQueryData(['availability', F, 'live', 'live', '', ''], availability));
    expect(html).toContain('Running vs stopped');
    expect(html).toMatch(/Running<\/span><\/span><span[^>]*><span[^>]*>14 h<\/span><span[^>]*>70%/);
    expect(html).toMatch(/Stopped<\/span><\/span><span[^>]*><span[^>]*>6 h<\/span><span[^>]*>30%/);
  });

  it('energy: by line across the factory, by line name', () => {
    const energy: EnergyResponse = {
      factory_id: F, from: 'a', to: 'b', total_energy_kwh: 40,
      machines: [
        { machine_id: 'm1', machine_name: 'Mixer 1', line_id: 'line-1', energy_kwh: 10, avg_amps: 1, peak_amps: 2, status: 'computed' },
        { machine_id: 'm2', machine_name: 'Press 2', line_id: 'line-2', energy_kwh: 30, avg_amps: 3, peak_amps: 4, status: 'computed' },
      ],
    };
    const html = render(<EnergySplit factoryId={F} />, (c) => c.setQueryData(['energy', F, 'live', 'live', '', ''], energy));
    expect(html).toContain('Energy by line');
    expect(html).toMatch(/Press shop<\/span><\/span><span[^>]*><span[^>]*>30 kWh<\/span><span[^>]*>75%/);
    expect(html).toContain('Weaving A');
  });
});
