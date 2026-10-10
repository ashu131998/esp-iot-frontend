'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { MetricBarChart } from '@/components/charts/metric-chart';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';

export function PerformanceChartSection({ factoryId }: { factoryId: string }) {
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['performance', factoryId, live ? 'live' : range.from, live ? 'live' : range.to, ...scopeKey],
    queryFn: ({ signal }) => api.performance(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const allMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const chartData = allMachines.map((m) => ({
    name: m.machine_name,
    performance: m.performance_percent,
    availability: m.availability_percent,
    throughput: m.throughput_percent ?? 0,
  }));

  return (
    <Card>
      <CardHeader title="Performance Breakdown" description="Availability and throughput contribution per machine" />
      <MetricBarChart
        data={chartData}
        bars={[
          { key: 'performance', color: '#6366f1', label: 'Performance %' },
          { key: 'availability', color: '#10b981', label: 'Availability %' },
          { key: 'throughput', color: '#3b82f6', label: 'Throughput %' },
        ]}
      />
    </Card>
  );
}
