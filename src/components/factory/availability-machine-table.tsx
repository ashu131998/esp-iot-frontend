'use client';

import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { ListGroup, ListRow } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import {
  RUN_BAD_PCT,
  RUN_WARN_PCT,
  STATE_WORD,
  humanMinutes,
  machineState,
  runTone,
  wholePercent,
} from '@/lib/plain-words';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';

export function AvailabilityMachineTable({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts, lines } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  // Availability for the window, and the last 24h only to know what each machine is doing now.
  const [{ data }, { data: uptimeData }] = useSuspenseQueries({
    queries: [
      {
        queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => api.availability(factoryId, apiRange, { signal }),
        refetchInterval,
        staleTime: 0,
      },
      {
        queryKey: ['uptime-24h', factoryId, ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => {
          const now = new Date();
          const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          return api.uptime(
            factoryId,
            {
              from: from24h,
              to: now.toISOString(),
              ...(machineId ? { machine_id: machineId } : {}),
              ...(lineId ? { line_id: lineId } : {}),
            },
            { signal },
          );
        },
        refetchInterval,
        staleTime: 0,
      },
    ],
  });

  const lineName = useMemo(() => new Map(lines.map((l) => [l.line_id, l.name])), [lines]);
  const nowState = useMemo(
    () => new Map(uptimeData.machines.map((m) => [m.machine_id, machineState(m.timeline.at(-1)?.status)])),
    [uptimeData],
  );
  const rows = useMemo(
    () =>
      [...filterMachinesByScope(data.machines, { machineId, lineId })].sort(
        (a, b) => (a.availability_percent ?? -1) - (b.availability_percent ?? -1),
      ),
    [data, machineId, lineId],
  );

  return (
    <ListGroup
      title="Machines"
      count={rows.length}
      hint={`Red under ${RUN_BAD_PCT}% · amber under ${RUN_WARN_PCT}%`}
      action={
        <ExportCsvButton
          filename="machine-availability"
          headers={['Machine', 'Line', 'Ran (min)', 'Stopped (min)', 'Running time %', 'Now']}
          rows={rows.map((m) => [
            m.machine_name,
            lineName.get(m.line_id) ?? m.line_id,
            m.uptime_minutes,
            m.downtime_minutes,
            m.availability_percent,
            STATE_WORD[nowState.get(m.machine_id) ?? 'no_signal'],
          ])}
        />
      }
    >
      {rows.map((m) => (
        <ListRow
          key={m.machine_id}
          href={`/factories/${factoryId}/machines/${m.machine_id}`}
          tone={runTone(m.availability_percent)}
          title={m.machine_name}
          tag={lineName.get(m.line_id) ?? m.line_id}
          detail={`${STATE_WORD[nowState.get(m.machine_id) ?? 'no_signal']} now · ran ${humanMinutes(m.uptime_minutes)} · stopped ${humanMinutes(m.downtime_minutes)}`}
          value={wholePercent(m.availability_percent)}
          valueHint="running"
        />
      ))}
    </ListGroup>
  );
}
