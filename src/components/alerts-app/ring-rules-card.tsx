'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff } from 'lucide-react';
import { useId, useState } from 'react';

import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { alertsApi } from '@/lib/alerts-app/api';
import {
  RING_KINDS, RING_RULES_QUERY_KEY, clockLabel, timeChoices, withChange, type RingKind, type RingRules, type RingRulesAnswer,
} from '@/lib/alerts-app/ring-rules';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/**
 * Settings, for an admin: when their phone rings (lib/alerts-app/ring-rules.ts). Ringing hours, a
 * stopped machine ringing outside them, and which kinds ring; an alert that does not ring still comes
 * into the inbox. Each change is saved at once. Not shown to workers (everything rings for them).
 */
export function RingRulesCard() {
  const { t } = useT();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: RING_RULES_QUERY_KEY, queryFn: ({ signal }) => alertsApi.ringRules(signal), staleTime: 60_000 });
  const [note, setNote] = useState<'saved' | 'failed' | null>(null);
  const save = useMutation({
    mutationFn: (rules: RingRules) => alertsApi.saveRingRules(rules),
    onMutate: (rules) => {
      setNote(null);
      const before = queryClient.getQueryData<RingRulesAnswer>(RING_RULES_QUERY_KEY);
      if (before) queryClient.setQueryData<RingRulesAnswer>(RING_RULES_QUERY_KEY, { ...before, rules });
      return { before };
    },
    onSuccess: (answer) => {
      queryClient.setQueryData(RING_RULES_QUERY_KEY, answer);
      setNote('saved');
    },
    onError: (_err, _rules, context) => {
      if (context?.before) queryClient.setQueryData(RING_RULES_QUERY_KEY, context.before);
      setNote('failed');
    },
  });

  const answer = query.data;
  // While the rules are on their way an admin's card holds its place (a worker has none): it came in late
  // and pushed the three sections under it down the screen (layout shift 0.27, measured 2026-11-24).
  if (query.isPending) return user?.role === 'admin' ? <RingRulesPlaceholder /> : null;
  if (!answer?.allowed) return null;
  const { rules } = answer;
  const change = (c: Parameters<typeof withChange>[1]) => save.mutate(withChange(rules, c));
  const kindLabel: Record<RingKind, string> = {
    machine_stopped: t('Machine stopped'),
    machine_running: t('Machine running again'),
    camera: t('Cameras'),
    shift: t('Shift reminders'),
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BellOff className="h-4 w-4" aria-hidden="true" />
        {t('When my phone rings')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('Alerts that do not ring still come into your inbox.')}</p>

      <div className="mt-4 space-y-3">
        <SwitchRow label={t('Only between these hours')} on={rules.hours.on} onChange={(on) => change({ hours: { on } })} />
        {rules.hours.on && (
          <div className="space-y-3 rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <TimeSelect label={t('From')} value={rules.hours.from} onChange={(from) => change({ hours: { from } })} />
              <span className="text-sm text-muted">{t('to')}</span>
              <TimeSelect label={t('To')} value={rules.hours.to} onChange={(to) => change({ hours: { to } })} />
            </div>
            <SwitchRow label={t('A stopped machine always rings')} on={rules.machine_always} onChange={(on) => change({ machine_always: on })} />
          </div>
        )}
      </div>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">{t('What rings')}</h3>
      <div className="mt-2 space-y-3">
        {RING_KINDS.map((kind) => (
          <SwitchRow key={kind} label={kindLabel[kind]} on={rules.kinds[kind]} onChange={(on) => change({ kind: [kind, on] })} />
        ))}
      </div>

      {note && (
        <p className={cn('mt-3 text-sm', note === 'saved' ? 'text-emerald-700' : 'text-red-700')} role="status">
          {note === 'saved' ? t('Saved') : t('Could not save. Try again.')}
        </p>
      )}
    </section>
  );
}

/** The card's own headings with a bar where each switch will be: the height of the card with ringing hours off. */
function RingRulesPlaceholder() {
  const { t } = useT();
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100" aria-busy="true">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BellOff className="h-4 w-4" aria-hidden="true" />
        {t('When my phone rings')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('Alerts that do not ring still come into your inbox.')}</p>
      <div className="mt-4 space-y-3">
        <Skeleton className="h-7 w-full" />
      </div>
      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">{t('What rings')}</h3>
      <div className="mt-2 space-y-3">
        {RING_KINDS.map((kind) => <Skeleton key={kind} className="h-7 w-full" />)}
      </div>
    </section>
  );
}

function SwitchRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={id} className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => onChange(!on)}
        className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors', on ? 'bg-primary' : 'bg-gray-300')}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1">
      {timeChoices().map((time) => <option key={time} value={time}>{clockLabel(time)}</option>)}
    </Select>
  );
}
