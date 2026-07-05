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

  const withAvail = displayMachines.filter((m) => m.availability_percent !== null);
  const overallAvailability =
    withAvail.length > 0
      ? withAvail.reduce((s, m) => s + (m.availability_percent ?? 0), 0) / withAvail.length
      : null;
  const totalUpHours = displayMachines.reduce((s, m) => s + m.up_hours, 0);
  const totalDownHours = displayMachines.reduce((s, m) => s + m.down_hours, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label={`Overall Availability (${rangeLabel})`} value={formatPercent(overallAvailability)} />
      <StatCard label="Loom Uptime" value={`${formatNumber(totalUpHours, 1)} h`} />
      <StatCard label="Loom Downtime" value={`${formatNumber(totalDownHours, 1)} h`} />
    </div>
  );
}
