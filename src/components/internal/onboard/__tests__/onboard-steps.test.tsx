/**
 * The onboarding wizard's steps rendered with sample drafts (server render, so it runs without a
 * browser or a backend): each shows what a staff member fills in, and the review never shows a
 * password.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { AdminBoard } from '@/lib/board-status';
import type { DisplayPage } from '@/lib/display';
import {
  emptySetupDraft, newBoard, newContact, newLine, newMachine, newWifi, newWorker, setAdminEmail, type SetupDraft,
} from '@/lib/onboarding';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}));

const { LookStep } = await import('@/components/internal/onboard/look-step');
const { SubscriptionStep } = await import('@/components/internal/onboard/subscription-step');
const { LinesStep } = await import('@/components/internal/onboard/lines-step');
const { WifiStep } = await import('@/components/internal/onboard/wifi-step');
const { BoardsStep } = await import('@/components/internal/onboard/boards-step');
const { WorkersEditor } = await import('@/components/internal/onboard/workers-editor');
const { ReportsStep } = await import('@/components/internal/onboard/reports-step');
const { ReviewStep } = await import('@/components/internal/onboard/review-step');
const { OnboardDone } = await import('@/components/internal/onboard/onboard-done');

const noop = () => {};
function render(node: ReactNode, catalog?: DisplayPage[], boards?: Partial<AdminBoard>[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (catalog) client.setQueryData(['display-catalog'], { pages: catalog });
  if (boards) client.setQueryData(['admin-boards'], { broker: 'ok', logins: null, boards });
  // React marks the joins between adjacent text pieces with <!-- -->: read the text as one.
  return renderToString(<QueryClientProvider client={client}>{node}</QueryClientProvider>).replaceAll('<!-- -->', '');
}

function filled(): SetupDraft {
  const d = emptySetupDraft('2026-11-03');
  d.factory = { factory_id: 'shree-mills', name: 'Shree Mills', location: 'Surat', referred_by: 'Patel Looms' };
  d.admins = [{ ...setAdminEmail(d.admins[0], 'owner@shree.in'), password: 'AdminPass123' }];
  const line = newLine('line-1', 'Weaving A');
  d.lines = [line];
  d.machines = [newMachine(line.key, 'Loom #1'), newMachine(line.key, 'Loom #2')];
  d.wifi = [{ ...newWifi(), ssid: 'Shree-Office', pass: 'WifiSecret99' }, { ...newWifi(), ssid: 'Shree-Floor', pass: '' }];
  d.boards = [{ ...newBoard('revb-311d80'), line_key: line.key, channels: { I1: d.machines[0].key, P1: d.machines[0].key } }, newBoard('rescue-a1b2c3', true)];
  d.workers = [{ ...newWorker(), name: 'Ravi', email: 'ravi@shree.in', password: 'WorkerPass1' }, { ...newWorker(), name: 'Sita' }];
  d.subscription = { ...d.subscription, enabled: true, ends_on: '2027-11-02', plan: 'Standard', machines: '40', monthly_amount: '24000' };
  d.reports = { ...d.reports, emails: 'owner@shree.in', owner_contacts: [{ ...newContact(), name: 'Mr Shah', phone: '+919876543210' }], value_per_loom_hour: '350' };
  return d;
}

describe('wizard steps', () => {
  it('Look: logo, colour, and the pages with their default switches', () => {
    const pages: DisplayPage[] = [
      { key: 'overview', label: 'Overview', fixed: true, default: true, sections: [{ key: 'overview.cards', label: 'Summary cards', default: true }] },
      { key: 'vibration', label: 'Vibration', fixed: false, default: false, sections: [] },
    ];
    const html = render(<LookStep value={{ accent_color: '', logo: null, features: {} }} onChange={noop} tried={false} />, pages);
    expect(html).toContain('Brand colour');
    expect(html).toContain('Choose a file');
    expect(html).toContain('Overview');
    expect(html).toContain('always on');
    expect(html).toContain('Summary cards');
    expect(html).toContain('Vibration');
  });

  it('Subscription: off by default; on, the dates and quick lengths', () => {
    expect(render(<SubscriptionStep value={emptySetupDraft('2026-11-03').subscription} onChange={noop} tried={false} />)).not.toContain('Ends on');
    const html = render(<SubscriptionStep value={filled().subscription} onChange={noop} tried={false} />);
    expect(html).toContain('Ends on (included)');
    expect(html).toContain('1 year');
    expect(html).toContain('3 Nov 2026 – 2 Nov 2027');
  });

  it('Lines & machines: the lines, a run of machines, the machine table', () => {
    const d = filled();
    const html = render(<LinesStep lines={d.lines} machines={d.machines} onChange={noop} tried={false} />);
    expect(html).toContain('Weaving A');
    expect(html).toContain('Add machines in one go');
    expect(html).toContain('Machines (2)');
    expect(html).toContain('Loom #1');
    expect(html).toMatch(/Add 10 machines/);   // Loom #3 … #12: #1 and #2 are there already
  });

  it('WiFi: names shown, passwords hidden', () => {
    const html = render(<WifiStep value={filled().wifi} onChange={noop} tried={false} />);
    expect(html).toContain('Shree-Office');
    expect(html).toContain('type="password"');
    expect(html).toContain('Up to 8');
  });

  it('Boards: the ones waiting, and each picked one with its line and what its sensors measure', () => {
    const d = filled();
    const waiting: Partial<AdminBoard>[] = [
      { board_id: 'revb-311d80', factory_id: 'unclaimed', line_id: 'new', online: true, beat: { fw: '2.7.0', st: 'pass' } },
      { board_id: 'revb-9f0e1d', factory_id: 'unclaimed', line_id: 'new', online: false, beat: { fw: '2.7.0' } },
      { board_id: 'rescue-a1b2c3', factory_id: 'unclaimed', line_id: 'new', online: true, kind: 'rescue', beat: { hw: 'rescue' } },
      { board_id: 'revb-304ad0', factory_id: 'demo-mill', line_id: 'line-1', online: true, beat: null },
    ];
    const html = render(<BoardsStep value={d.boards} lines={d.lines} machines={d.machines} onChange={noop} tried={false} canClaim />, undefined, waiting);
    expect(html).toContain('Waiting to be claimed');
    for (const text of ['revb-9f0e1d', 'Online', 'Not connected', 'fw 2.7.0', 'Pass', 'Rescue box', 'Weaving A', 'I1 · current (CT)', 'P2 · proximity', 'Not used', 'Loom #2']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('revb-304ad0');   // in a factory already
    expect(html.match(/>Added</g)).toHaveLength(2);
    expect(html).toContain('Goes to the factory alone');
    const none = render(<BoardsStep value={[]} lines={d.lines} machines={d.machines} onChange={noop} tried={false} canClaim />, undefined, []);
    expect(none).toContain('None waiting');
  });

  it('Boards: anyone but a super admin is pointed to the Boards page', () => {
    const d = filled();
    const html = render(<BoardsStep value={[]} lines={d.lines} machines={d.machines} onChange={noop} tried={false} canClaim={false} />);
    expect(html).toContain('Only a super admin can claim boards');
    expect(html).not.toContain('Waiting to be claimed');
  });

  it('Workers and Reports', () => {
    const d = filled();
    const workers = render(<WorkersEditor value={d.workers} onChange={noop} tried={false} />);
    expect(workers).toContain('Workers (optional)');
    expect(workers).toContain('Email (app login)');
    const reports = render(<ReportsStep value={{ ...d.reports, emails: '' }} onChange={noop} adminEmails={['owner@shree.in']} tried={false} />);
    expect(reports).toContain('Add the admins&#x27; emails');
    expect(reports).toContain('Results figures');
  });

  it('Review: every step summed up, no password anywhere', () => {
    const html = render(<ReviewStep d={filled()} onEdit={noop} />);
    for (const text of ['Shree Mills', 'shree-mills', 'Patel Looms', '3 Nov 2026 – 2 Nov 2027', 'Weaving A', '2 machines', 'Shree-Office', '(open)', 'revb-311d80', 'I1 Loom #1, P1 Loom #1', 'owner@shree.in', '2 workers, 1 with the alert app', 'Mobile alerts on']) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/rescue-a1b2c3<\/span><span[^>]*> · rescue box/);
    for (const secret of ['AdminPass123', 'WifiSecret99', 'WorkerPass1']) expect(html).not.toContain(secret);
  });

  it('Done: what was made, and app logins that were not', () => {
    const html = render(<OnboardDone
      onAnother={noop}
      result={{
        factory: { factory_id: 'shree-mills', name: 'Shree Mills' } as never,
        admins: [],
        emails: [{ username: 'owner@shree.in', email: 'owner@shree.in', sent: true }],
        lines: 1, machines: 2, wifi: 2,
        workers: [{ worker_id: 'w1', name: 'Ravi', app_login: 'failed: AlertOps down' }, { worker_id: 'w2', name: 'Sita', app_login: 'none' }],
        dashboard_url: 'https://app.floorbeat.in/f/shree-mills',
        request: { factory: { factory_id: 'shree-mills', name: 'Shree Mills', location: '' }, shifts: [], admins: [] },
      }}
    />);
    expect(html).toContain('Shree Mills is set up');
    expect(html).toContain('Also created: 1 line, 2 machines, 2 WiFi networks, 2 workers.');
    expect(html).toContain('Ravi: failed: AlertOps down');
    expect(html).not.toContain('Sita: none');
    expect(html).toContain('Claim its boards');
  });

  it('Done: each board claimed or not, and where to claim the rest', () => {
    const html = render(<OnboardDone
      onAnother={noop}
      result={{
        factory: { factory_id: 'shree-mills', name: 'Shree Mills' } as never,
        admins: [],
        emails: [{ username: 'owner@shree.in', email: 'owner@shree.in', sent: true }],
        lines: 1, machines: 2, wifi: 0, workers: [],
        boards: [
          { board_id: 'revb-311d80', rescue: false, line_id: 'line-1', channels: 2, claim: 'claimed' },
          { board_id: 'revb-9f0e1d', rescue: false, line_id: 'line-1', channels: 1, claim: 'failed: EMQX 503' },
          { board_id: 'rescue-a1b2c3', rescue: true, line_id: 'rescue', channels: 0, claim: 'claimed' },
        ],
        dashboard_url: 'https://app.floorbeat.in/f/shree-mills',
        request: { factory: { factory_id: 'shree-mills', name: 'Shree Mills', location: '' }, shifts: [], admins: [] },
      }}
    />);
    expect(html).toContain('Also created: 1 line, 2 machines, 2 boards claimed.');
    expect(html).toContain('line-1 · 2 sensors matched');
    expect(html).toContain('Not claimed: EMQX 503');
    expect(html).toMatch(/rescue-a1b2c3<\/span><span[^>]*> · rescue box/);
    expect(html).toContain('Claim those on the Boards page');
    expect(html).toContain('Its boards');
  });
});
