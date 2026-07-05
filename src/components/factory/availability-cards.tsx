'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Badge, StatCard } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { formatNumber, formatPercent } from '@/lib/utils';

const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;

export function AvailabilityCards({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate } = useFactoryRefs();
  const { machineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate), [from, to, minDate]);

  const refetchInterval = useRefetchInterval(REFRESH_MS);

  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live'],
    queryFn: ({ signal }) => api.availability(factoryId, range, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_SEC);

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const totalUptime = displayMachines.reduce((s, m) => s + m.uptime_minutes, 0);
  const totalDowntime = displayMachines.reduce((s, m) => s + m.downtime_minutes, 0);
  const avgAvailability =
    displayMachines.length > 0
      ? displayMachines.reduce((s, m) => s + (m.availability_percent ?? 0), 0) /
        displayMachines.length
      : data.avg_availability_percent;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Avg Availability" value={formatPercent(avgAvailability)} />
        <StatCard label="Loom Uptime" value={`${formatNumber(totalUptime, 0)} min`} />
        <StatCard label="Loom Downtime" value={`${formatNumber(totalDowntime, 0)} min`} />
      </div>

      {data.by_shift && data.by_shift.length > 0 && !machineId && (
        <Card>
          <CardHeader title="Availability by Shift" description="Last completed 12-hour shift per schedule" />
          <div className="grid gap-4 sm:grid-cols-2">
            {data.by_shift.map((s) => (
              <div key={s.shift_id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{s.name}</h4>
                  <Badge className="bg-blue-50 text-blue-700">{s.label}</Badge>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatPercent(s.avg_availability_percent)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
