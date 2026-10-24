'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatUnits, sharedUnitLabel, sumUnits } from '@/lib/utils';

const PRODUCTION_REFRESH_MS = 60_000;
const PRODUCTION_REFRESH_SEC = 60;

export function ProductionCards({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(PRODUCTION_REFRESH_MS);

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.production(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, PRODUCTION_REFRESH_SEC);

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const totalUnits = sumUnits(displayMachines);

  return (
    <StatCard
      label="Total Units Produced"
      value={formatUnits(totalUnits, sharedUnitLabel(displayMachines))}
      sub={`From proximity sensor detections${isFetching ? ' · updating…' : ''}`}
    />
  );
}
