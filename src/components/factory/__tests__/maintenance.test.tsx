/**
 * The Predictive maintenance page rendered with sample data (server render): the sentence, the
 * pie, each machine's signs; the service log; the tabs.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FactoryRefsProvider } from '@/lib/factory-refs-context';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';
import type { MaintenanceEntry, MaintenanceOverview } from '@/lib/types';

const auth = { canWriteFactory: true, isInternalStaff: false };
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/factories/mill-01/maintenance',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, className, ...rest }: { href: string; children: ReactNode; className?: string; 'aria-current'?: string }) => (
    <a href={href} className={className} aria-current={rest['aria-current'] as 'page' | undefined}>{children}</a>
  ),
}));

const { MachineHealth } = await import('@/components/factory/machine-health');
const { ServiceLog } = await import('@/components/factory/service-log');
const { MaintenanceDashboard } = await import('@/components/factory/maintenance-dashboard');

const F = 'mill-01';
const overview: MaintenanceOverview = {
  factory_id: F, at: '2026-11-04T12:00:00.000Z',
  machines: [
    {
      machine_id: 'm1', machine_name: 'Press 1', line_id: 'line-2', condition: 'now', score: 0,
      signs: [
        { kind: 'vibration', severity: 3, codes: ['vibration_alarm', 'vibration_rising'], value: 5.2, baseline: 3, change_pct: 73 },
        { kind: 'load', severity: 2, codes: ['load_up'], value: 6.5, baseline: 5, change_pct: 30 },
        { kind: 'service', severity: 2, codes: ['service_overdue'], value: 1200, baseline: 1000, change_pct: 120 },
      ],
      last_service: { done_at: '2026-09-01T06:00:00.000Z', kind: 'bearing', note: null }, service_interval_hours: 1000,
      running_hours_since_service: 1200, next_service: { hours_left: -200, days_left: -20, hours_per_day: 10 },
    },
    {
      machine_id: 'm2', machine_name: 'Mixer 1', line_id: 'line-1', condition: 'healthy', score: 100,
      signs: [{ kind: 'load', severity: 0, codes: ['load_steady'], value: 5, baseline: 5, change_pct: 0 }],
      last_service: null, service_interval_hours: null, running_hours_since_service: 300, next_service: null,
    },
    { machine_id: 'm3', machine_name: 'Packer 1', line_id: 'line-1', condition: 'no_data', score: null, signs: [], last_service: null, service_interval_hours: null, running_hours_since_service: null, next_service: null },
  ],
  summary: { machines: 3, conditions: { now: 1, soon: 0, watch: 0, healthy: 1, no_data: 1 } },
};
const refs = {
  machines: [{ machine_id: 'm1', name: 'Press 1', line_id: 'line-2' }, { machine_id: 'm2', name: 'Mixer 1', line_id: 'line-1' }],
  lines: [{ factory_id: F, line_id: 'line-1', name: 'line-1' }, { factory_id: F, line_id: 'line-2', name: 'Press shop' }],
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
const seedOverview = (c: QueryClient) => c.setQueryData(['maintenance', F, '', ''], overview);

describe('machine health', () => {
  it("the sentence, the pie and each machine's signs, worst first, with readable line names", () => {
    const html = render(<MachineHealth factoryId={F} />, seedOverview);
    expect(html).toContain('1 machine needs a service now');
    expect(html).toContain('2 of 3 machines have signs to read');
    expect(html).toContain('Machines by condition');
    expect(html).toContain('Vibration 5.2 mm/s, alarm zone · up +73% this week');
    expect(html).toContain('Motor load +30% against its first month (6.5 A, was 5 A)');
    expect(html).toContain('Service overdue: 1200 h run of 1000 h');
    expect(html).toContain('Service overdue by 200 h');
    expect(html).toMatch(/Last service 1 Sept(ember)? 2026: Bearing change/);
    expect(html).toContain('Health 0');
    expect(html).toContain('Press shop');
    expect(html).toContain('Line 1');   // "line-1" named by its ID alone
    expect(html.indexOf('Press 1')).toBeLessThan(html.indexOf('Mixer 1'));
    expect(html).toContain('No signs to read yet');
    expect(html).toContain('Record service');
    expect(html).toContain('/factories/mill-01/machines/m1');
  });

  it('in Hindi', () => {
    const html = render(<MachineHealth factoryId={F} />, seedOverview, hi);
    expect(html).toContain('1 मशीन को अभी सर्विस चाहिए');
    expect(html).toContain('कंपन 5.2 mm/s, अलार्म ज़ोन');
  });
});

describe('the service log and the tabs', () => {
  it('lists the services recorded', () => {
    const entries: MaintenanceEntry[] = [
      { id: 7, machine_id: 'm1', machine_name: 'Press 1', line_id: 'line-2', done_at: '2026-11-01T06:00:00.000Z', kind: 'bearing', note: 'left bearing', created_by: 'owner', created_at: null },
    ];
    const html = render(<ServiceLog factoryId={F} />, (c) => c.setQueryData(['maintenance-log', F, ''], { factory_id: F, entries }));
    expect(html).toContain('Service log');
    expect(html).toContain('Bearing change');
    expect(html).toContain('left bearing');
    expect(html).toContain('Press shop');
    expect(html).toContain('Record a service');
  });

  it('the tabs follow ?tab=', () => {
    search = '';
    let html = render(<MaintenanceDashboard factoryId={F} />, seedOverview);
    expect(html).toMatch(/aria-current="page"[^>]*>Machine health/);
    expect(html).toContain('href="/factories/mill-01/maintenance?tab=vibration"');
    search = 'tab=log';
    html = render(<MaintenanceDashboard factoryId={F} />, (c) => { seedOverview(c); c.setQueryData(['maintenance-log', F, ''], { factory_id: F, entries: [] }); });
    expect(html).toMatch(/aria-current="page"[^>]*>Service log/);
    expect(html).toContain('No service recorded yet.');
    search = '';
  });
});
