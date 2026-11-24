import { describe, expect, it } from 'vitest';

import {
  EMPTY_FORM, MESSAGE_MAX, SUBJECT_MAX, TICKET_TOPICS, formProblem, inQueue, minutesSince, newTicketBody, phoneOk, replaceTicket,
  splitTickets, statusTone, ticketRef, ticketSummary, type SupportTicket, type TicketForm,
} from '@/lib/support';

const ticket = (id: string, status: SupportTicket['status'], last: string, extra: Partial<SupportTicket> = {}): SupportTicket => ({
  ticket_id: id, ticket_no: 1000 + Number(id.replace(/\D/g, '') || 0), factory_id: 'mill', topic: 'machine', urgent: false,
  machine_id: null, machine_name: null, subject: id, status, raised_by: 'ravi', mine: true,
  created_at: last, updated_at: last, resolved_at: null, last_message_at: last, last_from_staff: null, message_count: 1, ...extra,
});

describe('the form', () => {
  const ok: TicketForm = { ...EMPTY_FORM, topic: 'machine', subject: '  Machine 3   not counting ', message: ' Since 2 am \n' };

  it('says the first thing wrong, in the order it is filled in', () => {
    expect(formProblem(EMPTY_FORM)).toBe('topic');
    expect(formProblem({ ...ok, subject: ' ab ' })).toBe('subject-short');
    expect(formProblem({ ...ok, subject: 'x'.repeat(SUBJECT_MAX + 1) })).toBe('subject-long');
    expect(formProblem({ ...ok, message: '  ' })).toBe('message-empty');
    expect(formProblem({ ...ok, message: 'x'.repeat(MESSAGE_MAX + 1) })).toBe('message-long');
    expect(formProblem({ ...ok, phone: 'call me' })).toBe('phone');
    expect(formProblem(ok)).toBeNull();
    expect(formProblem({ ...ok, phone: '+91 98765 43210' })).toBeNull();
  });

  it('is sent tidied, an empty machine and phone as none', () => {
    expect(newTicketBody(ok)).toEqual({ topic: 'machine', subject: 'Machine 3 not counting', message: 'Since 2 am', machine_id: null, phone: null, urgent: false });
    expect(newTicketBody({ ...ok, machine_id: 'm3', phone: ' 98765 43210 ', urgent: true }))
      .toMatchObject({ machine_id: 'm3', phone: '98765 43210', urgent: true });
  });

  it('phone numbers as the API takes them', () => {
    for (const good of ['', '98765 43210', '+91 98765 43210', '(0141) 222-3344']) expect(phoneOk(good), good).toBe(true);
    for (const bad of ['12345', 'call me', '9'.repeat(16), '1-2-3-4-5-6-7-8-9-0-1']) expect(phoneOk(bad), bad).toBe(false);
  });

  it('five topics, as the API has them', () => {
    expect(TICKET_TOPICS).toEqual(['machine', 'numbers', 'app', 'billing', 'other']);
  });
});

describe('the lists', () => {
  const rows = [
    ticket('t1', 'resolved', '2026-11-20T10:00:00Z'),
    ticket('t2', 'open', '2026-11-22T10:00:00Z'),
    ticket('t3', 'answered', '2026-11-23T10:00:00Z'),
    ticket('t4', 'resolved', '2026-11-21T10:00:00Z'),
    ticket('t5', 'open', '2026-11-21T10:00:00Z', { last_message_at: '2026-11-24T09:00:00Z' }),
  ];

  it('the factory\'s: not solved first by the newest message, then solved by when', () => {
    const { open, solved } = splitTickets(rows);
    expect(open.map((t) => t.ticket_id)).toEqual(['t5', 't3', 't2']);
    expect(solved.map((t) => t.ticket_id)).toEqual(['t4', 't1']);
    expect(rows[0].ticket_id).toBe('t1');   // the list it was given stays as it was
  });

  it('a ticket without a last message sorts by when it changed', () => {
    const bare = [ticket('a', 'open', '2026-11-20T10:00:00Z'), { ...ticket('b', 'open', '2026-11-21T10:00:00Z'), last_message_at: null as unknown as string }];
    expect(splitTickets(bare).open.map((t) => t.ticket_id)).toEqual(['b', 'a']);
    const undated = [{ ...ticket('c', 'resolved', ''), updated_at: '' }, ticket('d', 'resolved', '2026-11-21T10:00:00Z')];
    expect(splitTickets(undated).solved.map((t) => t.ticket_id)).toEqual(['d', 'c']);
  });

  it('how many wait on the factory and on us', () => {
    expect(ticketSummary(rows)).toEqual({ replied: 1, waiting: 2 });
    expect(ticketSummary([])).toEqual({ replied: 0, waiting: 0 });
  });

  it('our queue, by status', () => {
    expect(inQueue(rows, 'open').map((t) => t.ticket_id)).toEqual(['t2', 't5']);
    expect(inQueue(rows, 'answered').map((t) => t.ticket_id)).toEqual(['t3']);
    expect(inQueue(rows, 'resolved').map((t) => t.ticket_id)).toEqual(['t1', 't4']);
    expect(inQueue(rows, 'all')).toHaveLength(5);
  });

  it('a changed ticket replaces its old self in place; a new one goes first', () => {
    const changed = { ...rows[1], status: 'answered' as const };
    expect(replaceTicket(rows, changed)[1]).toBe(changed);
    expect(replaceTicket(rows, changed)).toHaveLength(5);
    const fresh = ticket('t9', 'open', '2026-11-24T10:00:00Z');
    expect(replaceTicket(rows, fresh)[0]).toBe(fresh);
  });
});

describe('small words', () => {
  it('the number people say, the dot\'s colour, minutes since', () => {
    expect(ticketRef({ ticket_no: 1042 })).toBe('#1042');
    expect(statusTone('answered')).toBe('warn');
    expect(statusTone('resolved')).toBe('good');
    expect(statusTone('open')).toBe('idle');
    const now = Date.parse('2026-11-24T10:00:00Z');
    expect(minutesSince('2026-11-24T09:15:30Z', now)).toBe(44);
    expect(minutesSince('2026-11-24T10:05:00Z', now)).toBe(0);
  });
});
