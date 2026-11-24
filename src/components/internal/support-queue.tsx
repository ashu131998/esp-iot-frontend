'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { TONE_DOT } from '@/components/ui/simple';
import { PHONE_HIDDEN, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import { isInternalAdmin } from '@/lib/internal-auth';
import {
  MESSAGE_MAX, inQueue, minutesSince, replaceTicket, statusTone, ticketRef,
  type QueueFilter, type StaffSupportTicket, type StaffSupportTicketsResponse, type TicketStatus, type TicketThread,
  type TicketTopic, type TicketUnit,
} from '@/lib/support';
import { cn } from '@/lib/utils';

const QUEUE_KEY = ['admin-support-tickets'];
const threadKey = (ticketId: string) => ['admin-support-ticket', ticketId];

/** Our words for a ticket's topic (query-api support.js SUPPORT_TOPICS). */
export const TOPIC_WORDS: Record<TicketTopic, string> = {
  machine: 'A machine or its monitoring unit',
  numbers: 'Numbers look wrong',
  app: 'Dashboard or alerts app',
  billing: 'Subscription or billing',
  other: 'Something else',
};

/** Where a ticket stands, from our side. */
export const STATUS_WORDS: Record<TicketStatus, string> = {
  open: 'Waiting on us',
  answered: 'Waiting on the factory',
  resolved: 'Solved',
};

const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'open', label: 'Waiting on us' },
  { key: 'answered', label: 'Waiting on the factory' },
  { key: 'resolved', label: 'Solved' },
  { key: 'all', label: 'All' },
];

export function ago(iso: string, nowMs: number): string {
  const m = minutesSince(iso, nowMs);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
}

/** How long from one moment to another: "25 min", "3 h", "2 days". */
export function span(fromIso: string, toMs: number): string {
  const m = minutesSince(fromIso, toMs);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} days`;
}

/** One unit as it was when the ticket was raised. */
export function unitText(unit: TicketUnit, raisedAt: string): string {
  const parts: string[] = [];
  if (unit.online) parts.push('on air');
  else if (unit.last_seen_at) parts.push(`off air, last report ${span(unit.last_seen_at, new Date(raisedAt).getTime())} before`);
  else parts.push('never reported');
  if (unit.fw) parts.push(`firmware ${unit.fw}`);
  if (unit.wifi_rssi !== null) parts.push(`WiFi ${unit.wifi_rssi} dBm`);
  return parts.join(' · ');
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * Our staff's Support page: every factory's tickets, waiting on us first (production stopped first,
 * then the longest waiting). A ticket opens in a sheet with who raised it, what its machine's units
 * said, the messages and a reply box (our admins; viewers read). ?ticket=… opens one (the email's link).
 */
export function SupportQueue() {
  const { user } = useAuth();
  const canAnswer = isInternalAdmin(user);
  const now = useNow();
  const search = useSearchParams();
  const [filter, setFilter] = useState<QueueFilter>('open');
  const [openId, setOpen] = useState<string | null>(() => search.get('ticket'));
  const openTicket = (id: string | null) => {
    setOpen(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('ticket', id);
    else url.searchParams.delete('ticket');
    window.history.replaceState(window.history.state, '', url);
  };
  const query = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: ({ signal }) => api.adminSupportTickets({ signal }),
    refetchInterval: 30_000,
  });

  if (query.isPending) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
  if (query.isError) return <Card><p className="text-sm text-red-600">Could not load the tickets: {(query.error as Error).message}</p></Card>;

  const { tickets, counts } = query.data;
  const shown = inQueue(tickets, filter);
  const urgent = tickets.filter((t) => t.status === 'open' && t.urgent).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm',
              filter === f.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-white hover:bg-slate-50',
            )}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums opacity-80">{f.key === 'all' ? tickets.length : counts[f.key]}</span>
          </button>
        ))}
        {urgent > 0 && (
          <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">{urgent} with production stopped</span>
        )}
      </div>

      <Card className="p-0 sm:p-0">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            {filter === 'open' ? 'Nothing waiting on us.' : 'No tickets here.'}
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Ticket</TH>
                <TH>Factory</TH>
                <TH className={PHONE_HIDDEN}>Raised by</TH>
                <TH className={PHONE_HIDDEN}>About</TH>
                <TH className={PHONE_HIDDEN}>Status</TH>
                <TH>Last message</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((t) => (
                <TR key={t.ticket_id} className="cursor-pointer hover:bg-slate-50" onClick={() => openTicket(t.ticket_id)}>
                  <TD>
                    <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); openTicket(t.ticket_id); }}>
                      <span className="font-medium">{ticketRef(t)} · {t.subject}</span>
                      {t.urgent && t.status !== 'resolved' && (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Production stopped</span>
                      )}
                    </button>
                  </TD>
                  <TD>{t.factory_name}</TD>
                  <TD className={PHONE_HIDDEN}>{t.raised_by}</TD>
                  <TD className={PHONE_HIDDEN}>{TOPIC_WORDS[t.topic] ?? t.topic}{t.machine_name ? ` · ${t.machine_name}` : ''}</TD>
                  <TD className={PHONE_HIDDEN}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', TONE_DOT[statusTone(t.status)])} />
                      {STATUS_WORDS[t.status]}
                    </span>
                  </TD>
                  <TD>
                    {ago(t.last_message_at ?? t.updated_at, now)}
                    {t.last_from_staff === false && t.status !== 'resolved' && <span className="text-muted"> · theirs</span>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {openId && <StaffTicketSheet ticketId={openId} canAnswer={canAnswer} onClose={() => openTicket(null)} />}
    </div>
  );
}

function useStaffThread(ticketId: string) {
  return useQuery({
    queryKey: threadKey(ticketId),
    queryFn: ({ signal }) => api.adminSupportTicket(ticketId, { signal }),
    refetchInterval: 15_000,
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

function StaffTicketSheet({ ticketId, canAnswer, onClose }: { ticketId: string; canAnswer: boolean; onClose: () => void }) {
  const ticket = useStaffThread(ticketId).data?.ticket;
  return (
    <Sheet title={ticket ? `${ticketRef(ticket)} · ${ticket.factory_name}` : 'Ticket'} onClose={onClose} size="lg">
      <StaffTicketBody ticketId={ticketId} canAnswer={canAnswer} />
    </Sheet>
  );
}

/** A ticket in our sheet: who raised it and how to reach them, its machine's units, the messages, our reply. */
export function StaffTicketBody({ ticketId, canAnswer }: { ticketId: string; canAnswer: boolean }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [solve, setSolve] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const query = useStaffThread(ticketId);
  const keep = (ticket: StaffSupportTicket, messages?: TicketThread['messages']) => {
    queryClient.setQueryData<TicketThread<StaffSupportTicket>>(threadKey(ticketId), (old) => ({ ticket, messages: messages ?? old?.messages ?? [] }));
    queryClient.setQueryData<StaffSupportTicketsResponse>(QUEUE_KEY, (old) => (old ? { ...old, tickets: replaceTicket(old.tickets, ticket) } : old));
    void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
  };
  const send = useMutation({
    mutationFn: () => api.adminReplySupportTicket(ticketId, { message: reply.trim(), resolve: solve }),
    onSuccess: (res) => {
      keep(res.ticket, res.messages);
      setReply('');
      setSolve(false);
      setNote(res.ticket.email ? (res.emailed ? `Emailed to ${res.ticket.email}.` : `Saved, but the email to ${res.ticket.email} did not go: they see it on their Support page.`) : 'Saved: they have no email, so they see it on their Support page.');
    },
  });
  const status = useMutation({
    mutationFn: (next: TicketStatus) => api.adminSetSupportStatus(ticketId, next),
    onSuccess: (res) => {
      keep(res.ticket);
      setNote(null);
    },
  });

  const ticket = query.data?.ticket;
  const context = ticket?.context ?? null;
  return (
    <>
      {query.isPending ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : query.isError || !ticket ? (
        <p className="text-sm text-muted">This ticket could not be found.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-base font-semibold">{ticket.subject}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', TONE_DOT[statusTone(ticket.status)])} />
                {STATUS_WORDS[ticket.status]}
              </span>
              {ticket.urgent && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Production is stopped</span>}
              <span>· Raised {formatDateTime(ticket.created_at)}</span>
            </p>
          </div>

          <dl className="grid gap-x-6 gap-y-2 rounded-xl border p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Factory</dt>
              <dd>
                {ticket.factory_name} <span className="font-mono text-xs text-muted">{ticket.factory_id}</span>
                <span className="block text-xs">
                  <Link href={`/factories/${ticket.factory_id}`} className="text-primary hover:underline">Dashboard</Link>
                  {' · '}
                  <Link href={`/internal/factories/${ticket.factory_id}`} className="text-primary hover:underline">Factory in the console</Link>
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Raised by</dt>
              <dd>
                {/* an account whose sign-in name is its email: said once */}
                {ticket.email?.toLowerCase() !== ticket.raised_by.toLowerCase() && ticket.raised_by}
                {ticket.email && (
                  <>
                    {ticket.email.toLowerCase() !== ticket.raised_by.toLowerCase() && ' · '}
                    <a href={`mailto:${ticket.email}`} className="text-primary hover:underline">{ticket.email}</a>
                  </>
                )}
                {ticket.phone && <> · <a href={`tel:${ticket.phone.replace(/[^\d+]/g, '')}`} className="text-primary hover:underline">{ticket.phone}</a></>}
              </dd>
            </div>
            <div>
              <dt className="text-muted">About</dt>
              <dd>{TOPIC_WORDS[ticket.topic] ?? ticket.topic}</dd>
            </div>
            {ticket.machine_name && (
              <div>
                <dt className="text-muted">Machine</dt>
                <dd>{ticket.machine_name}</dd>
              </div>
            )}
          </dl>

          {context && context.units.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-medium">Its monitoring units when the ticket was raised</p>
              <ul className="mt-1 space-y-1">
                {context.units.map((u) => (
                  <li key={u.board_id} className="flex items-start gap-2">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', u.online ? TONE_DOT.good : TONE_DOT.bad)} />
                    <span>
                      <Link href={`/internal/devices/${ticket.factory_id}/${u.board_id}`} className="font-mono text-primary hover:underline">{u.board_id}</Link>
                      {': '}
                      {unitText(u, context.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="space-y-3">
            {query.data.messages.map((m) => (
              <li key={m.message_id} className={cn('flex', m.from_staff ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5', m.from_staff ? 'bg-blue-50' : 'bg-slate-100')}>
                  <p className="text-xs font-semibold text-muted">
                    {m.from_staff ? `${m.author ?? 'FloorBeat'} (FloorBeat)` : m.author}
                    <span className="font-normal"> · {formatDateTime(m.created_at)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {canAnswer ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (reply.trim() && !send.isPending) send.mutate();
              }}
            >
              <Textarea
                aria-label="Reply"
                rows={4}
                maxLength={MESSAGE_MAX}
                value={reply}
                placeholder="Reply to the factory: they see it on their Support page and by email"
                onChange={(e) => setReply(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={solve} onChange={(e) => setSolve(e.target.checked)} className="h-4 w-4" />
                Mark it solved with this reply
              </label>
              {note && <p className="text-sm text-muted">{note}</p>}
              {(send.isError || status.isError) && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {((send.error ?? status.error) as Error).message}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {ticket.status === 'resolved' ? (
                  <Button type="button" variant="secondary" disabled={status.isPending} onClick={() => status.mutate('open')}>Open it again</Button>
                ) : (
                  <Button type="button" variant="secondary" disabled={status.isPending} onClick={() => status.mutate('resolved')}>Mark solved</Button>
                )}
                <Button type="submit" disabled={!reply.trim() || send.isPending}>{send.isPending ? 'Sending…' : 'Send reply'}</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">Viewers read tickets; our admins answer them.</p>
          )}
        </div>
      )}
    </>
  );
}
