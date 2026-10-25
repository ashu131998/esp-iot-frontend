'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { ListGroup, ListRow } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { runTone, wholePercent } from '@/lib/plain-words';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatUnits } from '@/lib/utils';

export function PerformanceTable({ factoryId }: { factoryId: string }) {
  const { lines } = useFactoryRefs();
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

  const lineName = useMemo(() => new Map(lines.map((l) => [l.line_id, l.name])), [lines]);
  const rows = useMemo(
    () =>
      [...filterMachinesByScope(data.machines, { machineId, lineId })].sort(
        (a, b) => (a.performance_percent ?? Infinity) - (b.performance_percent ?? Infinity),
      ),
    [data, machineId, lineId],
  );

  return (
    <ListGroup
      title="Machines"
      count={rows.length}
      hint="Furthest from target first"
      action={
        <ExportCsvButton
          filename="machine-performance"
          headers={['Machine', 'Line', 'Performance (P)', 'Availability (A)', 'Throughput (A×P)', 'Units Produced', 'Target Units', 'Cycle Target (s)']}
          rows={rows.map((m) => [
            m.machine_name,
            lineName.get(m.line_id) ?? m.line_id,
            m.performance_percent,
            m.availability_percent,
            m.throughput_percent,
            m.units_produced,
            m.target_units,
            m.target_cycle_time_sec,
          ])}
        />
      }
    >
      {rows.map((m) => (
        <ListRow
          key={m.machine_id}
          href={`/factories/${factoryId}/machines/${m.machine_id}`}
          tone={runTone(m.performance_percent)}
          title={m.machine_name}
          tag={lineName.get(m.line_id) ?? m.line_id}
          detail={[
            m.availability_percent == null ? 'No running data yet' : `Ran ${wholePercent(m.availability_percent)} of the time`,
            m.target_units > 0
              ? `made ${formatUnits(m.units_produced, m.unit_label)} of ${formatUnits(m.target_units, m.unit_label)}`
              : 'no target set',
          ].join(' · ')}
          value={wholePercent(m.performance_percent)}
          valueHint="on target"
        />
      ))}
    </ListGroup>
  );
}
