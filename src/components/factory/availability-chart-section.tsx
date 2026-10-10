'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StackedBarChart } from '@/components/charts/metric-chart';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';

export function AvailabilityChartSection({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate), [from, to, minDate]);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.availability(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const chartData = displayMachines.map((m) => ({
    name: m.machine_name,
    uptime: m.uptime_minutes,
    downtime: m.downtime_minutes,
  }));

  return (
    <Card>
      <CardHeader title="Uptime vs Downtime" description={`Per machine · ${rangeLabel}`} />
      <StackedBarChart
        data={chartData}
        keys={[
          { key: 'uptime', color: '#10b981', label: 'Uptime (min)' },
          { key: 'downtime', color: '#ef4444', label: 'Downtime (min)' },
        ]}
      />
    </Card>
  );
}
