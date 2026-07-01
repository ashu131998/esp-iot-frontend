'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { UPTIME_REFRESH_MS } from '@/components/uptime/refresh-countdown';
import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRangeLabel } from '@/lib/date-range';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { formatNumber, formatPercent } from '@/lib/utils';

export function UptimeCards({ factoryId }: { factoryId: string }) {
  const { range, live, machineId } = useFactoryDateRange();
  const refetchInterval = useRefetchInterval(UPTIME_REFRESH_MS);

  const displayTo = live ? new Date().toISOString() : range.to;
  const rangeLabel = formatRangeLabel(range.from, displayTo);

  const { data } = useSuspenseQuery({
    queryKey: ['uptime', factoryId, live ? 'live' : range.from, live ? 'live' : range.to],
    queryFn: ({ signal }) => api.uptime(factoryId, range, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const totalUpHours = displayMachines.reduce((s, m) => s + m.up_hours, 0);
  const totalDownHours = displayMachines.reduce((s, m) => s + m.down_hours, 0);
  const totalHours = totalUpHours + totalDownHours;
  const overallAvailability = totalHours > 0 ? (totalUpHours / totalHours) * 100 : null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label={`Overall Availability (${rangeLabel})`} value={formatPercent(overallAvailability)} />
      <StatCard label="Total Uptime" value={`${formatNumber(totalUpHours, 1)} h`} />
      <StatCard label="Total Downtime" value={`${formatNumber(totalDownHours, 1)} h`} />
    </div>
  );
}
