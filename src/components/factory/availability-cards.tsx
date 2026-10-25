'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { NumberTile, NumberTiles, SummaryCard } from '@/components/ui/simple';
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

  const totalUptime = displayMachines.reduce((s, m) => s + m.uptime_minutes, 0);
  const totalDowntime = displayMachines.reduce((s, m) => s + m.downtime_minutes, 0);
  const avgAvailability =
    displayMachines.length > 0
      ? displayMachines.reduce((s, m) => s + (m.availability_percent ?? 0), 0) /
        displayMachines.length
      : data.avg_availability_percent;
  const period = periodPhrase(from, to);
  const shiftsDone = !machineId
    ? (data.by_shift ?? []).filter((s) => s.avg_availability_percent != null)
    : [];

  return (
    <>
      <SummaryCard
        tone={runTone(avgAvailability)}
        badge={wholePercent(avgAvailability)}
        title={
          avgAvailability == null
            ? 'No running data yet'
            : `Machines ran ${wholePercent(avgAvailability)} of ${period}`
        }
        subtitle={`Ran ${humanMinutes(totalUptime)} · stopped ${humanMinutes(totalDowntime)} (all machines added up)`}
      />

      {shiftsDone.length > 0 && (
        <NumberTiles>
          {shiftsDone.map((s) => (
            <NumberTile
              key={s.shift_id}
              label={`Last ${s.name}`}
              value={wholePercent(s.avg_availability_percent)}
              hint={`ran · ${s.label}`}
              tone={runTone(s.avg_availability_percent)}
            />
          ))}
        </NumberTiles>
      )}
    </>
  );
}
