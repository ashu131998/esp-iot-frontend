'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { runTone, wholePercent } from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { averageKnown } from '@/lib/utils';

const PERFORMANCE_REFRESH_MS = 60_000;
const PERFORMANCE_REFRESH_SEC = 60;

export function PerformanceCards({ factoryId }: { factoryId: string }) {
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
      badge={wholePercent(avgPerformance)}
      title={avgPerformance == null ? 'Nothing to measure yet' : `Machines are ${wholePercent(avgPerformance)} on target`}
      subtitle={
        avgPerformance == null
          ? 'Needs a target and a piece count on each machine'
          : '100% = ran the whole time and made the full target'
      }
    />
  );
}
