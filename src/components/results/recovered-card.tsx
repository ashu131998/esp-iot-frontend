'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Hourglass, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { TONE_DOT } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import {
  formatPct, formatRupees, formatSignedHours, recoveredTone, resultsSummaryQueryKey,
} from '@/lib/results';
import { cn } from '@/lib/utils';

/**
 * Overview: this month's loom-hours won back against the first month, linking to Results. While
 * the first month is still being measured it says how far it has got. The overview page fetches
 * the figures on the server, so the card is there on the first paint.
 */
export function RecoveredCard({ factoryId }: { factoryId: string }) {
  const { t, locale } = useT();
  const { data } = useQuery({
    queryKey: resultsSummaryQueryKey(factoryId),
    queryFn: ({ signal }) => api.resultsSummary(factoryId, { signal }),
    staleTime: 5 * 60_000,
  });
  if (!data?.baseline) return null;

  const href = `/factories/${factoryId}/results`;
  let icon = <Hourglass className="h-5 w-5" />;
  let title: string;
  let subtitle: string;
  let tone = recoveredTone(null);

  if (!data.baseline.ready) {
    title = t('Measuring your first month: day {done} of {total}', {
      done: data.baseline.days_done, total: data.baseline.days_total,
    });
    subtitle = t('Later months are compared with it to show the loom-hours won back.');
  } else if (data.totals?.recovered_hours != null) {
    const hours = data.totals.recovered_hours;
    tone = recoveredTone(hours);
    icon = hours < 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />;
    title = t('{hours} loom-hours this month against your first month', { hours: formatSignedHours(hours, locale) });
    subtitle = t('Running {now} · first month {base}', {
      now: formatPct(data.totals.running_pct, locale),
      base: formatPct(data.totals.baseline_running_pct, locale),
    });
    if (data.money?.recovered_rupees != null) {
      subtitle += ` · ${t('worth {rupees}', { rupees: formatRupees(data.money.recovered_rupees, locale) })}`;
    }
  } else {
    return null;
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100 transition-colors hover:bg-gray-50"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white',
          TONE_DOT[tone],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="block text-sm text-muted">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}
