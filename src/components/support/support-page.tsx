'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, LifeBuoy, Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { ListEmpty, ListGroup, SummaryCard, TONE_DOT } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { formatDateTime } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n/context';
import {
  EMPTY_FORM, MESSAGE_MAX, PHONE_MAX, SUBJECT_MAX, TICKET_TOPICS, formProblem, minutesSince, newTicketBody, splitTickets,
  statusTone, ticketRef, ticketSummary, type FormProblem, type SupportTicket, type SupportTicketsResponse, type TicketForm,
  type TicketStatus, type TicketThread, type TicketTopic,
} from '@/lib/support';
import { cn } from '@/lib/utils';

type T = ReturnType<typeof useT>['t'];

const listKey = (factoryId: string) => ['support-tickets', factoryId];
const threadKey = (factoryId: string, ticketId: string) => ['support-ticket', factoryId, ticketId];

export function topicLabel(topic: TicketTopic, t: T): string {
  switch (topic) {
    case 'machine': return t('A machine or its monitoring unit');
    case 'numbers': return t('Numbers look wrong');
    case 'app': return t('Dashboard or alerts app');
    case 'billing': return t('Subscription or billing');
    default: return t('Something else');
  }
}

export function statusLabel(status: TicketStatus, t: T): string {
  if (status === 'answered') return t('FloorBeat replied');
  if (status === 'resolved') return t('Solved');
  return t('Waiting for FloorBeat');
}

export function problemText(problem: FormProblem, t: T): string {
  switch (problem) {
    case 'topic': return t('Choose what it is about.');
    case 'subject-short': return t('Give it a title of a few words.');
    case 'subject-long': return t('Make the title shorter.');
    case 'message-empty': return t('Write what happened.');
    case 'message-long': return t('Make the message shorter.');
    default: return t('That does not look like a phone number.');
  }
}

export function agoText(iso: string, nowMs: number, t: T): string {
  const m = minutesSince(iso, nowMs);
  if (m < 1) return t('Just now');
  if (m < 60) return t('{count} min ago', { count: m });
  if (m < 48 * 60) return t('{count} h ago', { count: Math.floor(m / 60) });
  return t('{count} days ago', { count: Math.floor(m / 1440) });
}

/** Re-render every minute, so "5 min ago" moves on. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** The ticket open in its sheet, kept in the address (?ticket=…) so an email's link opens it. */
function useOpenTicket(): [string | null, (id: string | null) => void] {
  const search = useSearchParams();
  const [open, setOpen] = useState<string | null>(() => search.get('ticket'));
  const change = (id: string | null) => {
    setOpen(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('ticket', id);
    else url.searchParams.delete('ticket');
    window.history.replaceState(window.history.state, '', url);
  };
  return [open, change];
}

/**
 * A factory's Support page: what it asked us and our replies, and "Raise a ticket". Its admins see
 * every ticket of the factory, everyone else the ones they raised. Our staff see them here too, and
 * answer on the staff console.
 */
export function SupportPage({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const { isInternalStaff } = useAuth();
  const now = useNow();
  const [raising, setRaising] = useState(false);
  const [openId, setOpenId] = useOpenTicket();
  const query = useQuery({
    queryKey: listKey(factoryId),
    queryFn: ({ signal }) => api.supportTickets(factoryId, { signal }),
    refetchInterval: 30_000,
  });

  if (query.isPending) return <Card><p className="text-sm text-muted">{t('Loading…')}</p></Card>;
  if (query.isError) return <Card><p className="text-sm text-muted">{t('Could not load your tickets. Try again in a moment.')}</p></Card>;

  const { tickets, sees_all: seesAll } = query.data;
  const { open, solved } = splitTickets(tickets);
  const sum = ticketSummary(tickets);
  const raise = isInternalStaff ? undefined : (
    <Button onClick={() => setRaising(true)} className="gap-1.5">
      <Plus className="h-4 w-4" />
      {t('Raise a ticket')}
    </Button>
  );

  return (
    <div className="space-y-6">
      {tickets.length === 0 ? (
        <SummaryCard tone="idle" icon={<LifeBuoy className="h-5 w-5" />} title={t('Need help? Raise a ticket')}
          subtitle={t('Tell us what is wrong: we reply here and by email.')} action={raise} />
      ) : sum.replied > 0 ? (
        <SummaryCard tone="warn" badge={sum.replied} title={tn(sum.replied, 'FloorBeat replied to a ticket', 'FloorBeat replied to {count} tickets')}
          subtitle={t('Open it to read the reply.')} action={raise} />
      ) : sum.waiting > 0 ? (
        <SummaryCard tone="idle" icon={<Clock className="h-5 w-5" />} title={tn(sum.waiting, 'We are looking at your ticket', 'We are looking at {count} tickets')}
          subtitle={t('We reply here and by email.')} action={raise} />
      ) : (
        <SummaryCard tone="good" title={t('No open tickets')} subtitle={t('Raise a ticket whenever something is wrong.')} action={raise} />
      )}

      {isInternalStaff && (
        <p className="px-1 text-sm text-muted">{t('Our staff answer these on the staff console (Support).')}</p>
      )}

      {tickets.length > 0 && (
        <ListGroup title={t('Open tickets')} count={open.length} hint={seesAll ? undefined : t('Only the ones you raised')}>
          {open.length === 0 ? (
            <ListEmpty>{t('None open.')}</ListEmpty>
          ) : (
            open.map((ticket) => <TicketRow key={ticket.ticket_id} ticket={ticket} now={now} onOpen={() => setOpenId(ticket.ticket_id)} />)
          )}
        </ListGroup>
      )}

      {solved.length > 0 && (
        <ListGroup title={t('Solved')} count={solved.length}>
          {solved.map((ticket) => <TicketRow key={ticket.ticket_id} ticket={ticket} now={now} onOpen={() => setOpenId(ticket.ticket_id)} />)}
        </ListGroup>
      )}

      {raising && (
        <RaiseTicketSheet
          factoryId={factoryId}
          onClose={() => setRaising(false)}
          onRaised={(ticket) => {
            setRaising(false);
            setOpenId(ticket.ticket_id);
          }}
        />
      )}
      {openId && <TicketSheet factoryId={factoryId} ticketId={openId} seesAll={seesAll} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TicketRow({ ticket, now, onOpen }: { ticket: SupportTicket; now: number; onOpen: () => void }) {
  const { t } = useT();
  // An admin sees everyone's: whose it is, when it is not their own.
  const detail = [
    statusLabel(ticket.status, t), ticket.machine_name, ticket.mine ? null : ticket.raised_by,
    agoText(ticket.last_message_at ?? ticket.updated_at, now, t),
  ].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[statusTone(ticket.status)])} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          <span className="text-muted">{ticketRef(ticket)}</span> · {ticket.subject}
        </span>
        <span className="block truncate text-sm text-muted">{detail}</span>
      </span>
      {ticket.urgent && ticket.status !== 'resolved' && (
        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{t('Production stopped')}</span>
      )}
    </button>
  );
}

function RaiseTicketSheet(props: { factoryId: string; onClose: () => void; onRaised: (ticket: SupportTicket) => void }) {
  const { t } = useT();
  return (
    <Sheet title={t('Raise a ticket')} onClose={props.onClose}>
      <RaiseTicketForm {...props} />
    </Sheet>
  );
}

/** The form in "Raise a ticket" (its sheet around it); `initial`: a draft to start from. */
export function RaiseTicketForm({
  factoryId, onClose, onRaised, initial = EMPTY_FORM,
}: {
  factoryId: string;
  onClose: () => void;
  onRaised: (ticket: SupportTicket) => void;
  initial?: TicketForm;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const { machines } = useFactoryRefs();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TicketForm>(initial);
  const [tried, setTried] = useState(false);
  const problem = formProblem(form);
  const mutation = useMutation({
    mutationFn: () => api.raiseSupportTicket(factoryId, newTicketBody(form)),
    onSuccess: (thread) => {
      queryClient.setQueryData(threadKey(factoryId, thread.ticket.ticket_id), thread);
      queryClient.setQueryData<SupportTicketsResponse>(listKey(factoryId), (old) => (old ? { ...old, tickets: [thread.ticket, ...old.tickets] } : old));
      void queryClient.invalidateQueries({ queryKey: listKey(factoryId) });
      onRaised(thread.ticket);
    },
  });
  const set = <K extends keyof TicketForm>(key: K, value: TicketForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const aboutMachines = form.topic === 'machine' || form.topic === 'numbers';

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!problem && !mutation.isPending) mutation.mutate();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">{t('What is it about?')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TICKET_TOPICS.map((topic) => (
            <label
              key={topic}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                form.topic === topic ? 'border-primary bg-blue-50/60 ring-1 ring-primary' : 'hover:bg-slate-50',
              )}
            >
              <input
                type="radio"
                name="topic"
                value={topic}
                checked={form.topic === topic}
                onChange={() => setForm((f) => ({
                  ...f,
                  topic,
                  machine_id: topic === 'machine' || topic === 'numbers' ? f.machine_id : '',
                  urgent: topic === 'billing' ? false : f.urgent,
                }))}
                className="h-4 w-4"
              />
              {topicLabel(topic, t)}
            </label>
          ))}
        </div>
      </fieldset>

      {aboutMachines && machines.length > 0 && (
        <Field label={t('Which machine?')}>
          <Select aria-label={t('Which machine?')} value={form.machine_id} onChange={(e) => set('machine_id', e.target.value)}>
            <option value="">{t('No particular machine')}</option>
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>{m.name ?? m.machine_id}</option>
            ))}
          </Select>
        </Field>
      )}

      {form.topic !== 'billing' && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm">
          <input type="checkbox" checked={form.urgent} onChange={(e) => set('urgent', e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="block font-medium text-foreground">{t('Production is stopped because of this')}</span>
            <span className="block text-muted">{t('We look at these first.')}</span>
          </span>
        </label>
      )}

      <Field label={t('Title')}>
        <Input
          aria-label={t('Title')}
          value={form.subject}
          maxLength={SUBJECT_MAX}
          placeholder={t('For example: Machine 3 shows stopped but it is running')}
          onChange={(e) => set('subject', e.target.value)}
        />
      </Field>

      <Field label={t('What happened?')}>
        <Textarea
          aria-label={t('What happened?')}
          value={form.message}
          rows={5}
          maxLength={MESSAGE_MAX}
          placeholder={t('What you saw, since when, and what you already tried.')}
          onChange={(e) => set('message', e.target.value)}
        />
      </Field>

      <Field label={t('Phone number to call you on (optional)')}>
        <Input
          aria-label={t('Phone number to call you on (optional)')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          maxLength={PHONE_MAX}
          onChange={(e) => set('phone', e.target.value)}
        />
      </Field>

      <p className="text-sm text-muted">
        {user?.email ? t('We reply here and by email to {email}.', { email: user.email }) : t('We reply here. Add a phone number if you would like a call.')}
      </p>

      {tried && problem && <p role="alert" className="text-sm font-medium text-red-600">{problemText(problem, t)}</p>}
      {mutation.isError && (
        <p role="alert" className="text-sm font-medium text-red-600">{t('Could not send it. Try again in a moment.')}</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('Sending…') : t('Send ticket')}</Button>
      </div>
    </form>
  );
}

function useThread(factoryId: string, ticketId: string) {
  return useQuery({
    queryKey: threadKey(factoryId, ticketId),
    queryFn: ({ signal }) => api.supportTicket(factoryId, ticketId, { signal }),
    refetchInterval: 15_000,
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

function TicketSheet(props: { factoryId: string; ticketId: string; seesAll: boolean; onClose: () => void }) {
  const { t } = useT();
  const ticket = useThread(props.factoryId, props.ticketId).data?.ticket;
  const title = ticket ? t('Ticket {number}', { number: ticketRef(ticket) }) : t('Ticket');
  return (
    <Sheet title={title} onClose={props.onClose}>
      <TicketConversation factoryId={props.factoryId} ticketId={props.ticketId} seesAll={props.seesAll} />
    </Sheet>
  );
}

/** A ticket in its sheet: what it is, the messages both ways, and a reply box (the factory's people). */
export function TicketConversation({ factoryId, ticketId, seesAll }: { factoryId: string; ticketId: string; seesAll: boolean }) {
  const { t } = useT();
  const locale = useLocale();
  const { isInternalStaff } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const query = useThread(factoryId, ticketId);
  const done = (thread: Pick<TicketThread, 'ticket'> & Partial<TicketThread>) => {
    queryClient.setQueryData<TicketThread>(threadKey(factoryId, ticketId), (old) => ({
      ticket: thread.ticket,
      messages: thread.messages ?? old?.messages ?? [],
    }));
    void queryClient.invalidateQueries({ queryKey: listKey(factoryId) });
  };
  const send = useMutation({
    mutationFn: () => api.replySupportTicket(factoryId, ticketId, reply.trim()),
    onSuccess: (thread) => {
      setReply('');
      done(thread);
    },
  });
  const resolve = useMutation({
    mutationFn: () => api.resolveSupportTicket(factoryId, ticketId),
    onSuccess: done,
  });

  const ticket = query.data?.ticket;

  return (
    <>
      {query.isPending ? (
        <p className="text-sm text-muted">{t('Loading…')}</p>
      ) : query.isError || !ticket ? (
        <p className="text-sm text-muted">{t('This ticket could not be found.')}</p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-base font-semibold text-foreground">{ticket.subject}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', TONE_DOT[statusTone(ticket.status)])} />
                {statusLabel(ticket.status, t)}
              </span>
              <span>· {topicLabel(ticket.topic, t)}</span>
              {ticket.machine_name && <span>· {ticket.machine_name}</span>}
              {seesAll && !ticket.mine && <span>· {t('Raised by {name}', { name: ticket.raised_by })}</span>}
            </p>
          </div>

          <ol className="space-y-3">
            {query.data.messages.map((m) => (
              <li key={m.message_id} className={cn('flex', m.from_staff ? 'justify-start' : 'justify-end')}>
                <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5', m.from_staff ? 'bg-slate-100' : 'bg-blue-50')}>
                  <p className="text-xs font-semibold text-muted">
                    {m.from_staff ? t('FloorBeat Support') : m.author}
                    <span className="font-normal"> · {formatDateTime(m.created_at, locale)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {ticket.status === 'resolved' && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {t('Solved. If it is not, write below and it opens again.')}
            </p>
          )}

          {isInternalStaff ? (
            <p className="text-sm text-muted">{t('Our staff answer these on the staff console (Support).')}</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (reply.trim() && !send.isPending) send.mutate();
              }}
            >
              <Textarea
                aria-label={t('Your reply')}
                rows={3}
                maxLength={MESSAGE_MAX}
                value={reply}
                placeholder={t('Write a reply…')}
                onChange={(e) => setReply(e.target.value)}
              />
              {(send.isError || resolve.isError) && (
                <p role="alert" className="text-sm font-medium text-red-600">{t('Could not send it. Try again in a moment.')}</p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {ticket.status !== 'resolved' && (
                  <Button type="button" variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
                    {t('It is solved')}
                  </Button>
                )}
                <Button type="submit" disabled={!reply.trim() || send.isPending}>{send.isPending ? t('Sending…') : t('Send reply')}</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
