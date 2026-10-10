'use client';

import { parseISO } from 'date-fns';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRangeLabel } from '@/lib/date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { DEFAULT_SHIFTS } from '@/lib/shifts';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatPercent } from '@/lib/utils';

const PERFORMANCE_REFRESH_MS = 60_000;
const PERFORMANCE_REFRESH_SEC = 60;

function getCurrentShiftName(from: string, to: string): string | null {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const now = new Date();
  if (toDate.getTime() < now.getTime() - 60_000) return null;
  const shift = DEFAULT_SHIFTS.find((s) => s.start_hour === fromDate.getHours());
  return shift?.name ?? null;
}

export function PerformanceCards({ factoryId }: { factoryId: string }) {
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const refetchInterval = useRefetchInterval(PERFORMANCE_REFRESH_MS);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const shiftName = getCurrentShiftName(range.from, range.to);
  const timeLabel = shiftName ?? rangeLabel;

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
      ? allMachines.reduce((s, m) => s + m.performance_percent, 0) / allMachines.length
      : data.avg_performance_percent;

  return (
    <StatCard
      label="Avg Performance (OEE-like)"
      value={formatPercent(avgPerformance)}
      sub={`Availability × throughput vs target · ${timeLabel}`}
    />
  );
}
