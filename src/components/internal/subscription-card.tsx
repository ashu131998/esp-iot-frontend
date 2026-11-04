'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { PHONE_HIDDEN, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import { SubscriptionBadge } from '@/components/internal/subscription-badge';
import {
  draftBody, draftOf, draftProblems, formatPeriod, nextPeriodDraft, periodEnd, todayKey,
  type PeriodDraft, type SubscriptionResponse,
} from '@/lib/subscriptions';
import { cn } from '@/lib/utils';

const LENGTHS: Array<[string, number]> = [['1 month', 1], ['3 months', 3], ['6 months', 6], ['1 year', 12]];

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/**
 * A factory's subscription, for our staff: where it stands, every period, and a sheet to add
 * one (a renewal starts the day after the current end) or change it. After the end date the
 * factory's machines keep recording, but its own users see data only up to that day and its
 * reports and alerts stop; a renewal opens everything recorded meanwhile.
 */
export function SubscriptionCard({ factoryId }: { factoryId: string }) {
  const queryClient = useQueryClient();
  const key = ['admin-subscription', factoryId];
  const { data, error, isLoading } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.adminSubscription(factoryId, { signal }),
  });
  const [editing, setEditing] = useState<{ id: number | null; draft: PeriodDraft } | null>(null);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = () => {
    setEditing(null);
    setTried(false);
    setConfirmDelete(false);
  };
  const settled = (next: SubscriptionResponse) => {
    queryClient.setQueryData(key, next);
    close();
  };
  const save = useMutation({
    mutationFn: ({ id, draft }: { id: number | null; draft: PeriodDraft }) => (id === null
      ? api.adminAddSubscriptionPeriod(factoryId, draftBody(draft))
      : api.adminUpdateSubscriptionPeriod(factoryId, id, draftBody(draft))),
    onSuccess: settled,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.adminDeleteSubscriptionPeriod(factoryId, id),
    onSuccess: settled,
  });

  const periods = data?.periods ?? [];
  const problems = editing ? draftProblems(editing.draft) : {};
  const set = (patch: Partial<PeriodDraft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));
  const open = (id: number | null, draft: PeriodDraft) => {
    save.reset();
    remove.reset();
    setEditing({ id, draft });
  };

  return (
    <Card>
      <CardHeader
        title={(
          <span className="flex flex-wrap items-center gap-2">
            Subscription
            <SubscriptionBadge status={data?.status} />
          </span>
        )}
        description="What the factory has paid for. After the end date its machines keep recording, but its own users see data only up to that day and its reports and alerts stop; renewing opens everything recorded meanwhile. Its admins are reminded a month before and on each of the last five days."
        action={(
          <Button type="button" size="sm" onClick={() => open(null, nextPeriodDraft(periods, todayKey()))} disabled={isLoading}>
            {periods.length > 0 ? 'Renew' : 'Add period'}
          </Button>
        )}
      />
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      {!error && !isLoading && periods.length === 0 && (
        <p className="text-sm text-muted">No subscription yet: the factory is not limited. Add its first period to set the end date and start the reminders.</p>
      )}
      {periods.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>Period</TH>
              <TH className={PHONE_HIDDEN}>Plan</TH>
              <TH className={PHONE_HIDDEN}>Machines</TH>
              <TH className={PHONE_HIDDEN}>Per month</TH>
              <TH className={PHONE_HIDDEN}>Notes</TH>
              <TH className="text-right">{' '}</TH>
            </TR>
          </THead>
          <TBody>
            {periods.map((p) => (
              <TR key={p.id}>
                <TD className="whitespace-nowrap font-medium">
                  {formatPeriod(p.starts_on, p.ends_on)}
                  {p.id === data?.status.period_id && <span className="ml-2 text-xs font-normal text-muted">current</span>}
                </TD>
                <TD className={PHONE_HIDDEN}>{p.plan ?? '–'}</TD>
                <TD className={PHONE_HIDDEN}>{p.machines ?? '–'}</TD>
                <TD className={PHONE_HIDDEN}>{p.monthly_amount != null ? rupees.format(p.monthly_amount) : '–'}</TD>
                <TD className={cn(PHONE_HIDDEN, 'max-w-[16rem] truncate')}>{p.notes ?? ''}</TD>
                <TD className="text-right">
                  <Button type="button" size="sm" variant="ghost" onClick={() => open(p.id, draftOf(p))}>Edit</Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {editing && (
        <Sheet title={editing.id === null ? 'Add a subscription period' : 'Change the period'} onClose={close}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setTried(true);
              if (Object.keys(problems).length === 0) save.mutate(editing);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts on">
                <Input type="date" value={editing.draft.starts_on} onChange={(e) => set({ starts_on: e.target.value })} />
                {tried && problems.starts_on && <p className="text-xs text-red-600">{problems.starts_on}</p>}
              </Field>
              <Field label="Ends on (included)">
                <Input type="date" value={editing.draft.ends_on} onChange={(e) => set({ ends_on: e.target.value })} />
                {tried && problems.ends_on && <p className="text-xs text-red-600">{problems.ends_on}</p>}
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map(([label, months]) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!/^\d{4}-\d{2}-\d{2}$/.test(editing.draft.starts_on)}
                  onClick={() => set({ ends_on: periodEnd(editing.draft.starts_on, months) })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Plan">
                <Input value={editing.draft.plan} maxLength={80} placeholder="Standard" onChange={(e) => set({ plan: e.target.value })} />
              </Field>
              <Field label="Machines">
                <Input inputMode="numeric" value={editing.draft.machines} placeholder="40" onChange={(e) => set({ machines: e.target.value })} />
                {tried && problems.machines && <p className="text-xs text-red-600">{problems.machines}</p>}
              </Field>
              <Field label="Per month (₹)">
                <Input inputMode="decimal" value={editing.draft.monthly_amount} placeholder="24000" onChange={(e) => set({ monthly_amount: e.target.value })} />
                {tried && problems.monthly_amount && <p className="text-xs text-red-600">{problems.monthly_amount}</p>}
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={2} maxLength={500} value={editing.draft.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            {(save.error || remove.error) && (
              <p className="text-sm text-red-600">{((save.error ?? remove.error) as Error).message}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
                <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
              </div>
              {editing.id !== null && (confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  Delete it?
                  <Button type="button" size="sm" variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(editing.id as number)}>
                    {remove.isPending ? 'Deleting…' : 'Delete'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
                </span>
              ) : (
                <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
                  Delete this period
                </Button>
              ))}
            </div>
          </form>
        </Sheet>
      )}
    </Card>
  );
}
