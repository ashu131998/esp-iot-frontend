/**
 * The Results page, the overview cards and the alerts follow-up rendered with fixed data, in every
 * state they can be in (server render, so it runs without a browser or a backend).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResultsResponse, SetupProgress, StopFollowUp } from '@/lib/results';
import { resultsQueryKey, resultsSummaryQueryKey, setupProgressQueryKey } from '@/lib/results';
import { hi } from '@/lib/i18n/messages/hi';
import { LocaleProvider } from '@/lib/i18n/context';

const auth = { canWriteFactory: false, isInternalStaff: false };
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const { ResultsDashboard } = await import('@/components/results/results-dashboard');
const { RecoveredCard } = await import('@/components/results/recovered-card');
const { SetupChecklistCard } = await import('@/components/results/setup-checklist-card');
const { StopFollowUpTiles } = await import('@/components/results/stop-follow-up-tiles');
const { DowntimeReportsCard } = await import('@/components/alerts/downtime-reports-card');

const F = 'mill-01';

const stops: StopFollowUp = {
  stops: 230, alerts: 212, alerts_acted_on: 198, alerts_acted_on_pct: 93.4, acted_on: 200, acted_on_pct: 87,
  explained: 190, explained_pct: 82.6, fixed_confirmed: 40, running_again: 228, closed: 196, still_stopped: 2,
  median_minutes_to_reason: 3, median_minutes_to_running: 14,
  reasons: [{ code: 'yarn_breakage', label: 'Yarn breakage', stops: 120, minutes: 900 }, { code: null, label: null, stops: 40, minutes: 300 }],
};

const ready: ResultsResponse = {
  factory_id: F, month: '2026-10', from: '2026-09-30T18:30:00.000Z', to: '2026-10-31T18:30:00.000Z',
  months: ['2026-11', '2026-10', '2026-09'], machines_monitored: 2,
  baseline: { from: '2026-08-01T00:30:00.000Z', to: '2026-08-31T00:30:00.000Z', source: 'first_month', ready: true, days_done: 30, days_total: 30, closed_shifts: 1 },
  window: { from: '2026-09-30T18:30:00.000Z', to: '2026-10-31T18:30:00.000Z' },
  data_to: '2026-10-31T12:30:00.000Z', closed_shifts: 2,
  totals: { compared_machines: 2, watched_hours: 1400, recovered_hours: 412.4, baseline_running_pct: 68.2, running_pct: 70.6, stopped_hours: 410, stopped_hours_at_baseline: 445.2 },
  machines: [
    { machine_id: 'loom-1', machine_name: 'Loom 1', line_id: 'A', baseline_hours: 700, baseline_running_pct: 60, hours: 700, running_pct: 70, recovered_hours: 70 },
    { machine_id: 'loom-2', machine_name: 'Loom 2', line_id: 'A', baseline_hours: 10, baseline_running_pct: 80, hours: 700, running_pct: 75, recovered_hours: null, status: 'no_baseline' as const },
  ].map((m) => ({ status: 'compared' as const, ...m })),
  money: { recovered_rupees: 144340, service_fee_rupees: 3000, net_rupees: 141340, return_multiple: 48.1, setup_fee_rupees: null, payback_months: null, no_upfront_cost: true },
  since_baseline: null,
  stops,
  settings: { value_per_loom_hour: 350, fee_per_machine_month: 1500, setup_fee: null, baseline_from: null, baseline_to: null, monthly_email: true, monthly_email_rupees: false, last_report_month: null, updated_at: null },
};

function render(node: ReactNode, cache: Array<[readonly unknown[], unknown]> = [], locale: 'en' | 'hi' = 'en') {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const [key, data] of cache) client.setQueryData(key, data);
  return renderToString(
    <LocaleProvider locale={locale} messages={locale === 'hi' ? hi : null}>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </LocaleProvider>,
  ).replace(/<!-- -->/g, '');
}

const dashboard = (data: ResultsResponse, locale: 'en' | 'hi' = 'en') =>
  render(<ResultsDashboard factoryId={F} factoryName="Shree Mill" initialMonth={data.month} />, [[resultsQueryKey(F, data.month), data]], locale);

beforeEach(() => {
  auth.canWriteFactory = false;
  auth.isInternalStaff = false;
});

describe('ResultsDashboard', () => {
  it('a month after the baseline: hours, rupees, follow-up and each loom', () => {
    auth.canWriteFactory = true;
    const html = dashboard(ready);
    expect(html).toContain('412.4 loom-hours won back in October 2026');
    expect(html).toContain('+412.4 h');
    expect(html).toContain('₹1,44,340');
    expect(html).toContain('48.1×');
    expect(html).toContain('No upfront cost');
    expect(html).toContain('198 of 212');
    expect(html).toContain('Yarn breakage');
    expect(html).toContain('No reason given');
    expect(html).toContain('Loom 1');
    expect(html).toContain('Not enough first-month data to compare yet');
    expect(html).toContain('3 shifts were left out because the floor was closed');
    expect(html).toContain('Copy as case study');
    expect(html).toContain('Settings');
  });

  it('without rupees for people who do not see them, and no admin buttons', () => {
    const html = dashboard({ ...ready, money: null, settings: null });
    expect(html).not.toContain('₹');
    expect(html).not.toContain('Copy as case study');
    expect(html).not.toContain('>Settings<');
    expect(html).toContain('+412.4 h');
  });

  it('a loss reads as a loss', () => {
    const html = dashboard({ ...ready, totals: { ...ready.totals!, recovered_hours: -12.25 } });
    expect(html).toContain('12.3 loom-hours below your first month in October 2026');
  });

  it('says where it stands before there is anything to compare', () => {
    expect(dashboard({ ...ready, baseline: null, window: null, totals: null, machines: [], money: null }))
      .toContain('No shift saved yet');
    expect(dashboard({ ...ready, baseline: { ...ready.baseline!, ready: false, days_done: 12 }, window: null, totals: null }))
      .toContain('Measuring your first month: day 12 of 30');
    expect(dashboard({ ...ready, month: '2026-09', window: null, totals: null, machines: [] }))
      .toContain('September 2026 is part of your first month');
    expect(dashboard({ ...ready, totals: null, machines: [] })).toContain('No saved shift in October 2026 yet');
  });

  it('in Hindi', () => {
    const html = dashboard(ready, 'hi');
    expect(html).toContain('वापस मिले लूम-घंटे');
    expect(html).not.toContain('Loom-hours recovered');
  });
});

describe('RecoveredCard', () => {
  const card = (data: ResultsResponse | undefined) =>
    render(<RecoveredCard factoryId={F} />, data ? [[resultsSummaryQueryKey(F), data]] : []);
  it('links this month\'s hours to Results', () => {
    const html = card(ready);
    expect(html).toContain('+412.4 h loom-hours this month against your first month');
    expect(html).toContain('worth ₹1,44,340');
    expect(html).toContain(`href="/factories/${F}/results"`);
  });
  it('counts the days of the first month, and is empty before any shift', () => {
    expect(card({ ...ready, baseline: { ...ready.baseline!, ready: false, days_done: 5 } })).toContain('day 5 of 30');
    expect(card({ ...ready, baseline: null })).toBe('');
    expect(card(undefined)).toBe('');
  });
});

describe('SetupChecklistCard', () => {
  const progress: SetupProgress = {
    factory_id: F, day: 3, days_promised: 7, done: 3, total: 6, complete: false, status: 'on_track', show: true,
    steps: [
      { key: 'boards', done: true, count: 10, of: 10, required: true },
      { key: 'mapped', done: false, count: 38, of: 40, required: true },
      { key: 'live', done: false, count: 36, of: 40, required: true },
      { key: 'first_shift', done: true, at: '2026-11-02T00:30:00.000Z', required: true },
      { key: 'alerts', done: true, required: true },
      { key: 'reports', done: false, required: true },
      { key: 'value', done: false, required: false },
    ],
  };
  const card = (p: SetupProgress) => render(<SetupChecklistCard factoryId={F} />, [[setupProgressQueryKey(F), p]]);
  it('shows the day, the counts and where to do each open step', () => {
    const html = card(progress);
    expect(html).toContain('Rollout: day 3 of 7');
    expect(html).toContain('3 of 6 done');
    expect(html).toContain('38 of 40');
    expect(html).toContain(`href="/factories/${F}/shift-reports"`);
    expect(html).toContain('(optional)');
  });
  it('says when the promise is passed, and stays away when not for this viewer', () => {
    expect(card({ ...progress, day: 9, status: 'late' })).toContain('Rollout: day 9, past the 7-day promise');
    expect(card({ ...progress, show: false })).toBe('');
  });
});

describe('StopFollowUpTiles', () => {
  it('counts alerts acted on and the medians', () => {
    const html = render(<StopFollowUpTiles data={stops} />);
    expect(html).toContain('198 of 212');
    expect(html).toContain('93.4% · reason given or fix confirmed');
    expect(html).toContain('14 m');
    expect(html).toContain('2 still stopped');
  });
});

describe('DowntimeReportsCard', () => {
  const now = Date.now();
  const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
  const reports = [
    { report_id: 'd1', factory_id: F, machine_id: 'loom-1', machine_name: 'Loom 1', device_id: null, down_since: iso(30), resolved_at: iso(20),
      reason_code: 'yarn_breakage', reason_label: 'Yarn breakage', reported_by_worker_id: null, reported_by_name: 'Ravi', reported_via: 'app',
      reason_reported_at: iso(28), fixed_at: iso(21), fixed_by_name: 'Ravi', created_at: iso(30) },
    { report_id: 'd2', factory_id: F, machine_id: 'loom-2', machine_name: 'Loom 2', device_id: null, down_since: iso(15), resolved_at: iso(5),
      reason_code: 'other', reason_label: 'Other', reported_by_worker_id: null, reported_by_name: null, reported_via: 'dashboard',
      reason_reported_at: iso(14), created_at: iso(15) },
  ];
  const cache: Array<[readonly unknown[], unknown]> = [
    [['downtime-reports', F], { factory_id: F, reports, total: 2, limit: 15, offset: 0 }],
    [['downtime-reasons', F], { reasons: [{ code: 'other', title: 'Other', description: '' }] }],
    [['stop-follow-up', F, 7], stops],
  ];
  it('shows who fixed a stop, the follow-up, and "Mark fixed" to admins only', () => {
    auth.canWriteFactory = true;
    const admin = render(<DowntimeReportsCard factoryId={F} />, cache);
    expect(admin).toContain('Fixed by Ravi');
    expect(admin).toContain('Follow-up, last 7 days');
    expect(admin).toContain('Mark fixed');
    auth.canWriteFactory = false;
    expect(render(<DowntimeReportsCard factoryId={F} />, cache)).not.toContain('Mark fixed');
  });
});
