'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { averageKnown, formatPercent } from '@/lib/utils';
import { runTone, wholePercent } from '@/lib/plain-words';

const PERFORMANCE_REFRESH_MS = 60_000;
const PERFORMANCE_REFRESH_SEC = 60;

export function PerformanceCards({ factoryId }: { factoryId: string }) {
  const { t, locale } = useT();
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const refetchInterval = useRefetchInterval(PERFORMANCE_REFRESH_MS);

  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['performance', factoryId, live ? 'live' : range.from, live ? 'live' : range.to, ...scopeKey],
    queryFn: ({ signal }) => api.performance(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, PERFORMANCE_REFRESH_SEC);

  const allMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const avgPerformance =
    allMachines.length > 0
      ? averageKnown(allMachines.map((m) => m.performance_percent))
      : data.avg_performance_percent;

  return (
    <SummaryCard
      tone={runTone(avgPerformance)}
      badge={avgPerformance == null ? undefined : wholePercent(avgPerformance)}
      title={avgPerformance == null
        ? t('No performance figures yet')
        : t('Machines made {pct} of their target', { pct: formatPercent(avgPerformance, locale) })}
      subtitle={t('Availability × throughput vs target')}
    />
  );
}
