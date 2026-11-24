/**
 * Our staff's Support page rendered (server render): the queue waiting on us first with its counts,
 * and a ticket with who raised it and how to reach them, what its machine's units said, the messages
 * and the reply box (our admins; viewers read).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StaffSupportTicket, TicketThread } from '@/lib/support';

const auth = vi.hoisted(() => ({ value: { user: { user_id: 'u-ash', role: 'super_admin' } } as Record<string, unknown> }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth.value }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}));

const { STATUS_WORDS, SupportQueue, StaffTicketBody, TOPIC_WORDS, ago, span, unitText } = await import('@/components/internal/support-queue');

const NOW = Date.now();
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const ticket = (no: number, status: StaffSupportTicket['status'], extra: Partial<StaffSupportTicket> = {}): StaffSupportTicket => ({
  ticket_id: `tkt-${no}`, ticket_no: no, factory_id: 'mill', factory_name: 'Shree Mill', topic: 'machine', urgent: false,
  machine_id: 'm3', machine_name: 'Machine 3', subject: `Problem ${no}`, status, raised_by: 'ravi', mine: false,
  created_at: iso(300), updated_at: iso(90), resolved_at: null, last_message_at: iso(90), last_from_staff: false, message_count: 1,
  user_id: 'u-ravi', email: 'ravi@mill.in', phone: '+91 98765 43210', context: null, ...extra,
});

function render(node: ReactNode, seed: (c: QueryClient) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } });
  seed(client);
  return renderToString(<QueryClientProvider client={client}>{node}</QueryClientProvider>).replace(/<!-- -->/g, '');
}

beforeEach(() => {
  auth.value = { user: { user_id: 'u-ash', role: 'super_admin' } };
});

describe('the queue', () => {
  const queue = (tickets: StaffSupportTicket[]) => render(<SupportQueue />, (c) => c.setQueryData(['admin-support-tickets'], {
    tickets, counts: { open: tickets.filter((t) => t.status === 'open').length, answered: tickets.filter((t) => t.status === 'answered').length, resolved: tickets.filter((t) => t.status === 'resolved').length },
  }));

  it('waiting on us first, with counts; production stopped flagged; whose turn', () => {
    const html = queue([ticket(1001, 'open', { urgent: true }), ticket(1002, 'open'), ticket(1003, 'answered', { last_from_staff: true }), ticket(1004, 'resolved')]);
    expect(html).toMatch(/Waiting on us<span[^>]*>2<\/span>/);
    expect(html).toMatch(/Waiting on the factory<span[^>]*>1<\/span>/);
    expect(html).toMatch(/Solved<span[^>]*>1<\/span>/);
    expect(html).toMatch(/All<span[^>]*>4<\/span>/);
    expect(html).toContain('1 with production stopped');
    expect(html).toContain('#1001 · Problem 1001');
    expect(html).toContain('#1002 · Problem 1002');
    expect(html).not.toContain('Problem 1003');   // the filter starts on "Waiting on us"
    expect(html).toContain('Shree Mill');
    expect(html).toContain('A machine or its monitoring unit · Machine 3');
    expect(html).toContain('1 h ago');
    expect(html).toContain(' · theirs');
  });

  it('nothing waiting on us', () => {
    expect(queue([ticket(1004, 'resolved')])).toContain('Nothing waiting on us.');
    expect(render(<SupportQueue />)).toContain('Loading…');
  });

  it('could not load', () => {
    const html = render(<SupportQueue />, (c) => {
      c.getQueryCache().build(c, { queryKey: ['admin-support-tickets'] }).setState({ status: 'error', error: new Error('Forbidden'), fetchStatus: 'idle' });
    });
    expect(html).toContain('Could not load the tickets: Forbidden');
  });
});

describe('a ticket', () => {
  const thread = (extra: Partial<StaffSupportTicket> = {}): TicketThread<StaffSupportTicket> => ({
    ticket: ticket(1001, 'open', {
      urgent: true,
      context: {
        at: iso(300),
        machine: { machine_id: 'm3', name: 'Machine 3', line_id: 'line-1' },
        units: [
          { board_id: 'revb-1', online: false, last_seen_at: iso(480), fw: '2.9.4', wifi_rssi: -71 },
          { board_id: 'revb-2', online: true, last_seen_at: iso(300), fw: null, wifi_rssi: null },
        ],
      },
      ...extra,
    }),
    messages: [
      { message_id: 'm1', from_staff: false, author: 'ravi', body: 'Not counting', created_at: iso(300) },
      { message_id: 'm2', from_staff: true, author: 'ashutosh', body: 'Looking now', created_at: iso(200) },
    ],
  });
  const view = (t: TicketThread<StaffSupportTicket>, canAnswer = true) =>
    render(<StaffTicketBody ticketId="tkt-1001" canAnswer={canAnswer} />, (c) => c.setQueryData(['admin-support-ticket', 'tkt-1001'], t));

  it('who raised it and how to reach them, the factory, its units then, the messages, our reply', () => {
    const html = view(thread());
    expect(html).toContain('Production is stopped');
    expect(html).toContain('href="mailto:ravi@mill.in"');
    expect(html).toContain('href="tel:+919876543210"');
    expect(html).toContain('href="/factories/mill"');
    expect(html).toContain('href="/internal/factories/mill"');
    expect(html).toContain('Its monitoring units when the ticket was raised');
    expect(html).toContain('href="/internal/devices/mill/revb-1"');
    expect(html).toContain('off air, last report 3 h before · firmware 2.9.4 · WiFi -71 dBm');
    expect(html).toContain('on air');
    expect(html).toContain('ashutosh (FloorBeat)');
    expect(html).toContain('Not counting');
    expect(html).toContain('Mark it solved with this reply');
    expect(html).toContain('Mark solved');
    expect(html).toContain('Send reply');
  });

  it('solved: open it again; no email or phone, no units', () => {
    const html = view(thread({ status: 'resolved', email: null, phone: null, context: null, machine_name: null }));
    expect(html).toContain('Open it again');
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('tel:');
    expect(html).not.toContain('Its monitoring units');
    expect(html).not.toContain('>Machine<');
  });

  it('an account whose sign-in name is its email is named once, as the link', () => {
    const html = view(thread({ raised_by: 'Ravi@Mill.in' }));
    expect(html.match(/ravi@mill\.in/gi)).toHaveLength(2);   // the link's address and its text
    expect(html).toContain('<a href="mailto:ravi@mill.in"');
  });

  it('a viewer reads it', () => {
    const html = view(thread(), false);
    expect(html).toContain('Viewers read tickets; our admins answer them.');
    expect(html).not.toContain('Send reply');
  });

  it('loading, and one that is not there', () => {
    expect(render(<StaffTicketBody ticketId="tkt-9" canAnswer />)).toContain('Loading…');
    const html = render(<StaffTicketBody ticketId="tkt-9" canAnswer />, (c) => {
      c.getQueryCache().build(c, { queryKey: ['admin-support-ticket', 'tkt-9'] }).setState({ status: 'error', error: new Error('No such ticket'), fetchStatus: 'idle' });
    });
    expect(html).toContain('This ticket could not be found.');
  });
});

describe('words', () => {
  it('topics and statuses as the server has them', () => {
    expect(Object.keys(TOPIC_WORDS)).toEqual(['machine', 'numbers', 'app', 'billing', 'other']);
    expect(STATUS_WORDS).toEqual({ open: 'Waiting on us', answered: 'Waiting on the factory', resolved: 'Solved' });
  });

  it('how long ago, how long between, a unit in a line', () => {
    const now = Date.parse('2026-11-24T10:00:00Z');
    expect(ago('2026-11-24T09:59:30Z', now)).toBe('just now');
    expect(ago('2026-11-24T09:35:00Z', now)).toBe('25 min ago');
    expect(ago('2026-11-24T07:00:00Z', now)).toBe('3 h ago');
    expect(ago('2026-11-20T10:00:00Z', now)).toBe('4 days ago');
    expect(span('2026-11-24T09:35:00Z', now)).toBe('25 min');
    expect(span('2026-11-24T07:00:00Z', now)).toBe('3 h');
    expect(span('2026-11-21T10:00:00Z', now)).toBe('3 days');
    expect(unitText({ board_id: 'b', online: false, last_seen_at: null, fw: null, wifi_rssi: null }, '2026-11-24T10:00:00Z')).toBe('never reported');
  });
});
