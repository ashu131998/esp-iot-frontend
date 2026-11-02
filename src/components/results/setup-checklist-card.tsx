'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';
import type { Translate } from '@/lib/i18n/translate';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval } from '@/lib/refresh-context';
import { setupProgressQueryKey, setupStepHref, type SetupStep } from '@/lib/results';
import { cn } from '@/lib/utils';

/** Each step in words (literal t() calls, so the translation check sees them). */
function stepLabel(step: SetupStep, t: Translate): string {
  switch (step.key) {
    case 'boards':
      return t('Boards fitted and online');
    case 'mapped':
      return t('Every loom has a sensor');
    case 'live':
      return t('Every loom live');
    case 'first_shift':
      return t('First full shift recorded');
    case 'alerts':
      return t('Stop alerts reach a phone');
    case 'reports':
      return t('Shift report emails on');
    case 'value':
      return t('Rupee value of a loom-hour set (for the monthly results)');
    default:
      return step.key;
  }
}

/**
 * The first-week rollout, for the factory's admins and our staff (the API decides who sees it):
 * day N of 7 and the steps to "every loom live". Gone once every step is done.
 */
export function SetupChecklistCard({ factoryId }: { factoryId: string }) {
  const { t } = useT();
  const refetchInterval = useRefetchInterval(60_000);
  const { data } = useQuery({
    queryKey: setupProgressQueryKey(factoryId),
    queryFn: ({ signal }) => api.setupProgress(factoryId, { signal }),
    staleTime: 60_000,
    refetchInterval,
  });
  if (!data?.show) return null;

  const late = data.status === 'late';
  const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h3 className="font-semibold text-foreground">
          {late
            ? t('Rollout: day {day}, past the {days}-day promise', { day: data.day ?? 0, days: data.days_promised })
            : t('Rollout: day {day} of {days}', { day: data.day ?? 1, days: data.days_promised })}
        </h3>
        <span className="text-sm text-muted">{t('{done} of {total} done', { done: data.done, total: data.total })}</span>
      </div>
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full', late ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-2 divide-y divide-gray-100">
        {data.steps.map((step) => {
          const href = step.done ? null : setupStepHref(step.key, factoryId);
          const counts = step.of != null && step.of > 0 ? t('{count} of {total}', { count: step.count ?? 0, total: step.of }) : null;
          const body = (
            <>
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-gray-300" />
              )}
              <span className={cn('min-w-0 flex-1 text-sm', step.done ? 'text-muted' : 'text-foreground')}>
                {stepLabel(step, t)}
                {!step.required && <span className="ml-1 text-xs text-muted">({t('optional')})</span>}
              </span>
              {counts && <span className="shrink-0 text-sm tabular-nums text-muted">{counts}</span>}
              {href && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
            </>
          );
          return (
            <li key={step.key}>
              {href ? (
                <Link href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-5 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-5 pb-4 pt-1 text-xs text-muted">
        {t('FloorBeat promises every loom live within the first week. This list goes away once it is done.')}
      </p>
    </section>
  );
}
