'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { StackedBarChart } from '@/components/charts/metric-chart';
import { UPTIME_REFRESH_MS } from '@/components/uptime/refresh-countdown';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatRangeLabel } from '@/lib/date-range';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';

export function UptimeChartSection({ factoryId }: { factoryId: string }) {
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const refetchInterval = useRefetchInterval(UPTIME_REFRESH_MS);

  const displayTo = live ? new Date().toISOString() : range.to;
  const rangeLabel = formatRangeLabel(range.from, displayTo);
  const uptimeParams = { ...range, ...(machineId ? { machine_id: machineId } : {}), ...(lineId ? { line_id: lineId } : {}) };

  const { data } = useSuspenseQuery({
    queryKey: ['uptime', factoryId, live ? 'live' : range.from, live ? 'live' : range.to, lineId ?? '', machineId ?? ''],
    queryFn: ({ signal }) => api.uptime(factoryId, uptimeParams, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const summaryData = displayMachines.map((m) => ({
    name: m.machine_name,
    up: m.up_hours,
    down: m.down_hours,
  }));

  return (
    <Card>
      <CardHeader title="Loom Uptime vs Downtime" description={`Running/stopped hours per machine · ${rangeLabel}`} />
      <StackedBarChart
        data={summaryData}
        keys={[
          { key: 'up', color: '#10b981', label: 'Running (hours)' },
          { key: 'down', color: '#ef4444', label: 'Stopped (hours)' },
        ]}
      />
    </Card>
  );
}
