'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Badge, StatCard } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { humanMinutes, periodPhrase, runTone, wholePercent } from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { averageKnown, formatPercent } from '@/lib/utils';

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
  const { minDate, shifts } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(REFRESH_MS);

  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.availability(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_SEC);

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const machineCount = displayMachines.length;
  const totalUptime = displayMachines.reduce((s, m) => s + m.uptime_minutes, 0);
  const totalDowntime = displayMachines.reduce((s, m) => s + m.downtime_minutes, 0);
  const uptimeMin =
    machineCount > 0 ? totalUptime / machineCount : 0;
  const downtimeMin =
    machineCount > 0 ? totalDowntime / machineCount : 0;
  const avgAvailability =
    machineCount > 0
      ? averageKnown(displayMachines.map((m) => m.availability_percent))
      : data.avg_availability_percent;
  const multiMachine = machineCount > 1;
  const timeSubtitle = multiMachine
    ? `Average per machine: ran ${humanMinutes(uptimeMin)} · stopped ${humanMinutes(downtimeMin)}`
    : `Ran ${humanMinutes(uptimeMin)} · stopped ${humanMinutes(downtimeMin)}`;

  return (
    <>
      <SummaryCard
        tone={runTone(avgAvailability)}
        badge={wholePercent(avgAvailability)}
        title={
          avgAvailability == null
            ? 'No running data yet'
            : multiMachine
              ? `On average, machines ran ${wholePercent(avgAvailability)} of ${periodPhrase(from, to)}`
              : `Machine ran ${wholePercent(avgAvailability)} of ${periodPhrase(from, to)}`
        }
        subtitle={timeSubtitle}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={multiMachine ? 'Avg uptime per machine' : 'Uptime'}
          value={humanMinutes(uptimeMin)}
        />
        <StatCard
          label={multiMachine ? 'Avg downtime per machine' : 'Downtime'}
          value={humanMinutes(downtimeMin)}
        />
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
