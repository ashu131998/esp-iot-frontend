'use client';

import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import type { SubscriptionDraft } from '@/lib/onboarding';
import { draftProblems, formatPeriod, isDayKey, periodEnd } from '@/lib/subscriptions';

const LENGTHS: Array<[string, number]> = [['1 month', 1], ['3 months', 3], ['6 months', 6], ['1 year', 12]];

/**
 * The first subscription period, optional: without one the factory is not limited. After the
 * end date its users see data only up to that day, and its admins are reminded before it.
 */
export function SubscriptionStep({
  value, onChange, tried,
}: { value: SubscriptionDraft; onChange: (next: SubscriptionDraft) => void; tried: boolean }) {
  const set = (patch: Partial<SubscriptionDraft>) => onChange({ ...value, ...patch });
  const problems = value.enabled ? draftProblems(value) : {};
  const show = (k: keyof typeof problems) => tried && problems[k] && <p className="text-xs text-red-600">{problems[k]}</p>;

  return (
    <>
      <CardHeader
        title="Subscription"
        description="Optional. Without one the factory is not limited. With one, its admins are reminded a month before the end and on each of the last five days; after the end its users see data up to that day only, until it is renewed."
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({
            enabled: e.target.checked,
            ends_on: value.ends_on || (isDayKey(value.starts_on) ? periodEnd(value.starts_on, 12) : ''),
          })}
        />
        Set its subscription now
      </label>

      {value.enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts on">
              <Input type="date" value={value.starts_on} onChange={(e) => set({ starts_on: e.target.value })} />
              {show('starts_on')}
            </Field>
            <Field label="Ends on (included)">
              <Input type="date" value={value.ends_on} onChange={(e) => set({ ends_on: e.target.value })} />
              {show('ends_on')}
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {LENGTHS.map(([label, months]) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant="secondary"
                disabled={!isDayKey(value.starts_on)}
                onClick={() => set({ ends_on: periodEnd(value.starts_on, months) })}
              >
                {label}
              </Button>
            ))}
            {isDayKey(value.starts_on) && isDayKey(value.ends_on) && value.ends_on >= value.starts_on && (
              <span className="text-sm text-muted">{formatPeriod(value.starts_on, value.ends_on)}</span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Plan">
              <Input value={value.plan} maxLength={80} placeholder="Standard" onChange={(e) => set({ plan: e.target.value })} />
            </Field>
            <Field label="Machines">
              <Input inputMode="numeric" value={value.machines} placeholder="40" onChange={(e) => set({ machines: e.target.value })} />
              {show('machines')}
            </Field>
            <Field label="Per month (₹)">
              <Input inputMode="decimal" value={value.monthly_amount} placeholder="24000" onChange={(e) => set({ monthly_amount: e.target.value })} />
              {show('monthly_amount')}
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} maxLength={500} value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      )}
    </>
  );
}
