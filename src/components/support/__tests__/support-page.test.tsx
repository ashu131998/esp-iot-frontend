/**
 * The Support page rendered (server render): what the factory sees first in each state, its tickets
 * (only their own for a worker), the "Raise a ticket" form, and a ticket's conversation with a reply
 * box; our staff see it without one. In English and Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FactoryRefsProvider } from '@/lib/factory-refs-context';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';
import { EMPTY_FORM, type SupportTicket, type TicketThread } from '@/lib/support';
import type { Machine } from '@/lib/types';

const auth = vi.hoisted(() => ({
  value: { user: { user_id: 'u-ravi', email: 'ravi@mill.in', role: 'employee' }, isInternalStaff: false } as Record<string, unknown>,
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth.value }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const { SupportPage, RaiseTicketForm, TicketConversation, agoText, problemText, statusLabel, topicLabel } = await import('@/components/support/support-page');

const NOW = Date.now();
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const ticket = (no: number, status: SupportTicket['status'], extra: Partial<SupportTicket> = {}): SupportTicket => ({
  ticket_id: `tkt-${no}`, ticket_no: no, factory_id: 'mill', topic: 'machine', urgent: false, machine_id: 'm3', machine_name: 'Machine 3',
  subject: `Problem ${no}`, status, raised_by: 'ravi', mine: true, created_at: iso(300), updated_at: iso(120), resolved_at: null,
  last_message_at: iso(120), last_from_staff: status === 'answered', message_count: 2, ...extra,
});
const MACHINES = [{ machine_id: 'm3', name: 'Machine 3' }, { machine_id: 'm4', name: 'Machine 4' }] as Machine[];

function render(node: ReactNode, seed: (c: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } });
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>
        <FactoryRefsProvider value={{ machines: MACHINES, lines: [], minDate: null, maxDate: null, shifts: [], display: {} }}>
          {node}
        </FactoryRefsProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
}
const page = (tickets: SupportTicket[], seesAll = false, messages: Record<string, string> | null = null) =>
  render(<SupportPage factoryId="mill" />, (c) => c.setQueryData(['support-tickets', 'mill'], { tickets, sees_all: seesAll }), messages);

beforeEach(() => {
  auth.value = { user: { user_id: 'u-ravi', email: 'ravi@mill.in', role: 'employee' }, isInternalStaff: false };
});

describe('the Support page', () => {
  it('loading, then a first ticket asked for', () => {
    expect(render(<SupportPage factoryId="mill" />)).toContain('Loading…');
    const html = page([]);
    expect(html).toContain('Need help? Raise a ticket');
    expect(html).toContain('Tell us what is wrong: we reply here and by email.');
    expect(html).toContain('Raise a ticket');
    expect(html).not.toContain('Open tickets');
  });

  it('a reply from us comes first; each ticket with its number, status, machine and when', () => {
    const html = page([ticket(1001, 'open', { urgent: true }), ticket(1002, 'answered'), ticket(1003, 'resolved', { urgent: true })]);
    expect(html).toContain('FloorBeat replied to a ticket');
    expect(html).toContain('Open it to read the reply.');
    expect(html).toContain('#1002');
    expect(html).toContain('Problem 1002');
    expect(html).toContain('FloorBeat replied · Machine 3 · 2 h ago');
    expect(html).toContain('Waiting for FloorBeat · Machine 3 · 2 h ago');
    expect(html.match(/Production stopped/g)).toHaveLength(1);   // a solved one is not flagged
    expect(html).toContain('Solved');
    expect(html).toContain('Only the ones you raised');
  });

  it('waiting on us, all solved; the factory\'s admin sees every ticket', () => {
    expect(page([ticket(1001, 'open'), ticket(1004, 'open')])).toContain('We are looking at 2 tickets');
    expect(page([ticket(1005, 'open', { mine: false, raised_by: 'meena' })], true)).toContain('Waiting for FloorBeat · Machine 3 · meena · 2 h ago');
    const solved = page([ticket(1003, 'resolved')], true);
    expect(solved).toContain('No open tickets');
    expect(solved).toContain('None open.');
    expect(solved).not.toContain('Only the ones you raised');
  });

  it('our staff see the tickets but raise none here', () => {
    auth.value = { user: { user_id: 'u-ash', role: 'super_admin', email: null }, isInternalStaff: true };
    const html = page([ticket(1001, 'open')], true);
    expect(html).toContain('Our staff answer these on the staff console (Support).');
    expect(html).not.toContain('Raise a ticket');
  });

  it('in Hindi', () => {
    const html = page([ticket(1002, 'answered')], false, hi);
    expect(html).toContain('FloorBeat ने एक टिकट का जवाब दिया');
    expect(html).toContain('टिकट बनाएँ');
    expect(html).toContain('खुले टिकट');
  });

  it('could not load', () => {
    const html = render(<SupportPage factoryId="mill" />, (c) => {
      c.setQueryData(['support-tickets', 'mill'], undefined);
      c.getQueryCache().build(c, { queryKey: ['support-tickets', 'mill'] }).setState({ status: 'error', error: new Error('down'), fetchStatus: 'idle' });
    });
    expect(html).toContain('Could not load your tickets. Try again in a moment.');
  });
});

describe('raising a ticket', () => {
  const form = (initial = EMPTY_FORM) => render(<RaiseTicketForm factoryId="mill" onClose={() => {}} onRaised={() => {}} initial={initial} />);

  it('what it is about, a title, what happened, a phone; where we reply', () => {
    const html = form();
    for (const text of ['What is it about?', 'A machine or its monitoring unit', 'Numbers look wrong', 'Dashboard or alerts app',
      'Subscription or billing', 'Something else', 'Production is stopped because of this', 'Title', 'What happened?',
      'Phone number to call you on (optional)', 'We reply here and by email to ravi@mill.in.', 'Send ticket', 'Cancel']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('Which machine?');   // until it is about a machine
    expect(html).toContain('maxLength="120"');
  });

  it('about a machine: which one; about billing: no "production stopped"', () => {
    const machine = form({ ...EMPTY_FORM, topic: 'machine', machine_id: 'm4' });
    expect(machine).toContain('Which machine?');
    expect(machine).toContain('No particular machine');
    expect(machine).toMatch(/<option value="m4" selected="">Machine 4<\/option>/);
    expect(form({ ...EMPTY_FORM, topic: 'numbers' })).toContain('Which machine?');
    const billing = form({ ...EMPTY_FORM, topic: 'billing' });
    expect(billing).not.toContain('Which machine?');
    expect(billing).not.toContain('Production is stopped because of this');
  });

  it('someone without an email is offered a call', () => {
    auth.value = { user: { user_id: 'u-meena', email: null, role: 'employee' }, isInternalStaff: false };
    expect(form()).toContain('We reply here. Add a phone number if you would like a call.');
  });
});

describe('a ticket\'s conversation', () => {
  const thread = (status: SupportTicket['status'], extra: Partial<SupportTicket> = {}): TicketThread => ({
    ticket: ticket(1002, status, extra),
    messages: [
      { message_id: 'm1', from_staff: false, author: 'ravi', body: 'Machine 3 shows stopped\nbut it runs', created_at: iso(200) },
      { message_id: 'm2', from_staff: true, author: null, body: 'We restarted its unit.', created_at: iso(120) },
    ],
  });
  const view = (t: TicketThread, seesAll = false, messages: Record<string, string> | null = null) =>
    render(<TicketConversation factoryId="mill" ticketId="tkt-1002" seesAll={seesAll} />, (c) => c.setQueryData(['support-ticket', 'mill', 'tkt-1002'], t), messages);

  it('what it is, both sides\' messages, a reply box and "It is solved"', () => {
    const html = view(thread('answered'));
    expect(html).toContain('Problem 1002');
    expect(html).toContain('FloorBeat replied');
    expect(html).toContain('A machine or its monitoring unit');
    expect(html).toContain('Machine 3 shows stopped\nbut it runs');
    expect(html).toContain('FloorBeat Support');
    expect(html).toContain('We restarted its unit.');
    expect(html).toContain('aria-label="Your reply"');
    expect(html).toContain('It is solved');
    expect(html).toContain('Send reply');
    expect(html).not.toContain('Raised by');
  });

  it('solved: how to open it again; the admin sees who raised someone else\'s', () => {
    const html = view(thread('resolved', { mine: false, raised_by: 'meena' }), true);
    expect(html).toContain('Solved. If it is not, write below and it opens again.');
    expect(html).not.toContain('It is solved');
    expect(html).toContain('Raised by meena');
  });

  it('our staff read it here, answer on the console', () => {
    auth.value = { user: { user_id: 'u-ash', role: 'super_admin', email: null }, isInternalStaff: true };
    const html = view(thread('open'));
    expect(html).toContain('Our staff answer these on the staff console (Support).');
    expect(html).not.toContain('Send reply');
  });

  it('loading, and one that is not there', () => {
    expect(render(<TicketConversation factoryId="mill" ticketId="tkt-9" seesAll={false} />)).toContain('Loading…');
    const missing = render(<TicketConversation factoryId="mill" ticketId="tkt-9" seesAll={false} />, (c) => {
      c.getQueryCache().build(c, { queryKey: ['support-ticket', 'mill', 'tkt-9'] }).setState({ status: 'error', error: new Error('404'), fetchStatus: 'idle' });
    });
    expect(missing).toContain('This ticket could not be found.');
  });

  it('in Hindi', () => {
    const html = view(thread('answered'), false, hi);
    expect(html).toContain('FloorBeat सहायता');
    expect(html).toContain('जवाब भेजें');
  });
});

describe('words', () => {
  const t = (s: string, v?: Record<string, unknown>) => (v ? `${s} ${JSON.stringify(v)}` : s);
  it('topics, statuses and what is wrong with the form', () => {
    expect(['machine', 'numbers', 'app', 'billing', 'other'].map((x) => topicLabel(x as never, t))).toEqual([
      'A machine or its monitoring unit', 'Numbers look wrong', 'Dashboard or alerts app', 'Subscription or billing', 'Something else',
    ]);
    expect(['open', 'answered', 'resolved'].map((x) => statusLabel(x as never, t))).toEqual(['Waiting for FloorBeat', 'FloorBeat replied', 'Solved']);
    expect(['topic', 'subject-short', 'subject-long', 'message-empty', 'message-long', 'phone'].map((x) => problemText(x as never, t))).toEqual([
      'Choose what it is about.', 'Give it a title of a few words.', 'Make the title shorter.', 'Write what happened.',
      'Make the message shorter.', 'That does not look like a phone number.',
    ]);
  });

  it('how long ago', () => {
    const now = Date.parse('2026-11-24T10:00:00Z');
    expect(agoText('2026-11-24T09:59:40Z', now, t)).toBe('Just now');
    expect(agoText('2026-11-24T09:35:00Z', now, t)).toBe('{count} min ago {"count":25}');
    expect(agoText('2026-11-24T05:00:00Z', now, t)).toBe('{count} h ago {"count":5}');
    expect(agoText('2026-11-20T10:00:00Z', now, t)).toBe('{count} days ago {"count":4}');
  });
});
