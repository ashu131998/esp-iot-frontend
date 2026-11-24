/**
 * Support tickets: a factory's people raise them on its Support page, our staff answer on the staff
 * console's Support page (query-api support.js has the rules, support-routes.js the API). Types and
 * pure helpers for both pages.
 *
 * A ticket's status: 'open' (waiting on FloorBeat), 'answered' (FloorBeat replied: waiting on the
 * factory), 'resolved'. A message from the factory opens it again.
 */

export type TicketStatus = 'open' | 'answered' | 'resolved';
export type TicketTopic = 'machine' | 'numbers' | 'app' | 'billing' | 'other';

export const TICKET_TOPICS: readonly TicketTopic[] = ['machine', 'numbers', 'app', 'billing', 'other'];

/** As the API checks them (support.js). */
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 4000;
export const PHONE_MAX = 20;

export interface SupportTicket {
  ticket_id: string;
  ticket_no: number;
  factory_id: string;
  topic: TicketTopic;
  urgent: boolean;
  machine_id: string | null;
  machine_name: string | null;
  subject: string;
  status: TicketStatus;
  raised_by: string;
  /** Raised by the person looking. */
  mine: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_message_at: string;
  last_from_staff: boolean | null;
  message_count: number | null;
}

/** What a machine's monitoring units said when the ticket was raised (our staff only). */
export interface TicketUnit {
  board_id: string;
  online: boolean;
  last_seen_at: string | null;
  fw: string | null;
  wifi_rssi: number | null;
}

export interface TicketContext {
  at: string;
  machine: { machine_id: string; name: string; line_id: string | null };
  units: TicketUnit[];
}

export interface StaffSupportTicket extends SupportTicket {
  factory_name: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  context: TicketContext | null;
}

export interface SupportMessage {
  message_id: string;
  from_staff: boolean;
  /** Who wrote it; null for our staff's, on the factory's side ("FloorBeat Support"). */
  author: string | null;
  body: string;
  created_at: string;
}

export interface TicketThread<T extends SupportTicket = SupportTicket> {
  ticket: T;
  messages: SupportMessage[];
}

export interface SupportTicketsResponse {
  tickets: SupportTicket[];
  /** Every ticket of the factory (its admins, our staff), not only the person's own. */
  sees_all: boolean;
}

export interface StaffSupportTicketsResponse {
  tickets: StaffSupportTicket[];
  counts: Record<TicketStatus, number>;
}

export interface NewTicket {
  topic: TicketTopic;
  subject: string;
  message: string;
  machine_id: string | null;
  phone: string | null;
  urgent: boolean;
}

/** The form as typed. */
export interface TicketForm {
  topic: TicketTopic | '';
  machine_id: string;
  urgent: boolean;
  subject: string;
  message: string;
  phone: string;
}

export const EMPTY_FORM: TicketForm = { topic: '', machine_id: '', urgent: false, subject: '', message: '', phone: '' };

export type FormProblem = 'topic' | 'subject-short' | 'subject-long' | 'message-empty' | 'message-long' | 'phone';

/** "#1042": what people say on the phone. */
export function ticketRef(ticket: Pick<SupportTicket, 'ticket_no'>): string {
  return `#${ticket.ticket_no}`;
}

/** A phone number to call back on, as people write one (support.js parsePhone). */
export function phoneOk(phone: string): boolean {
  const p = phone.trim().replace(/\s+/g, ' ');
  if (!p) return true;
  const digits = p.replace(/\D/g, '').length;
  return p.length <= PHONE_MAX && /^\+?[\d\s()-]+$/.test(p) && digits >= 6 && digits <= 15;
}

/** The first thing wrong with the form, or null when it can be sent. */
export function formProblem(form: TicketForm): FormProblem | null {
  if (!form.topic) return 'topic';
  const subject = form.subject.trim().replace(/\s+/g, ' ');
  if (subject.length < SUBJECT_MIN) return 'subject-short';
  if (subject.length > SUBJECT_MAX) return 'subject-long';
  const message = form.message.trim();
  if (!message) return 'message-empty';
  if (message.length > MESSAGE_MAX) return 'message-long';
  if (!phoneOk(form.phone)) return 'phone';
  return null;
}

/** What the API is sent for the form (only once formProblem says nothing). */
export function newTicketBody(form: TicketForm): NewTicket {
  return {
    topic: form.topic as TicketTopic,
    subject: form.subject.trim().replace(/\s+/g, ' '),
    message: form.message.trim(),
    machine_id: form.machine_id || null,
    phone: form.phone.trim() || null,
    urgent: form.urgent,
  };
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

/** The factory's list: what is not solved (newest activity first), then what is. */
export function splitTickets<T extends SupportTicket>(tickets: readonly T[]): { open: T[]; solved: T[] } {
  const byActivity = (a: T, b: T) => time(b.last_message_at ?? b.updated_at) - time(a.last_message_at ?? a.updated_at);
  return {
    open: tickets.filter((t) => t.status !== 'resolved').sort(byActivity),
    solved: tickets.filter((t) => t.status === 'resolved').sort((a, b) => time(b.updated_at) - time(a.updated_at)),
  };
}

/** How many tickets wait on the factory (we replied) and on us. */
export function ticketSummary(tickets: readonly SupportTicket[]): { replied: number; waiting: number } {
  return {
    replied: tickets.filter((t) => t.status === 'answered').length,
    waiting: tickets.filter((t) => t.status === 'open').length,
  };
}

/** The dot beside a ticket: amber when it is the factory's turn, green when solved, grey while we look. */
export function statusTone(status: TicketStatus): 'warn' | 'good' | 'idle' {
  if (status === 'answered') return 'warn';
  if (status === 'resolved') return 'good';
  return 'idle';
}

/** Minutes since a moment (never below 0). */
export function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

/**
 * Our staff's queue, as the API orders it (support.js staffOrder): waiting on us first (production
 * stopped first, then the longest waiting), then waiting on the factory, then solved.
 */
export type QueueFilter = 'open' | 'answered' | 'resolved' | 'all';

export function inQueue<T extends SupportTicket>(tickets: readonly T[], filter: QueueFilter): T[] {
  return filter === 'all' ? [...tickets] : tickets.filter((t) => t.status === filter);
}

/** A ticket in a list, changed in place (after a reply or a status), kept where it is. */
export function replaceTicket<T extends SupportTicket>(tickets: readonly T[], ticket: T): T[] {
  const at = tickets.findIndex((t) => t.ticket_id === ticket.ticket_id);
  if (at < 0) return [ticket, ...tickets];
  return tickets.map((t, i) => (i === at ? ticket : t));
}
