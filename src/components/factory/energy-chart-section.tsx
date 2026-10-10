'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { MetricBarChart } from '@/components/charts/metric-chart';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';

export function EnergyChartSection({
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
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.energy(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const chartData = displayMachines
    .filter((m) => m.energy_kwh !== null)
    .map((m) => ({ name: m.machine_name, energy: m.energy_kwh ?? 0 }));

  return (
    <Card>
      <CardHeader title="Energy by Machine" description="kWh estimated from RMS current × voltage × time" />
      <MetricBarChart
        data={chartData}
        bars={[{ key: 'energy', color: '#f59e0b', label: 'Energy (kWh)' }]}
      />
    </Card>
  );
}
