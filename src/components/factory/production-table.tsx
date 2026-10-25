'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { ListGroup, ListRow } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
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

export function ProductionTable({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts, lines, machines } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.production(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const lineName = useMemo(() => new Map(lines.map((l) => [l.line_id, l.name])), [lines]);
  const windowHours = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 3_600_000;

  const rows = useMemo(() => {
    const perHour = new Map(machines.map((m) => [m.machine_id, m.target_units_per_hour ?? 0]));
    const list = filterMachinesByScope(data.machines, { machineId, lineId }).map((m) => {
      const target = (perHour.get(m.machine_id) ?? 0) * windowHours;
      return { ...m, target, pct: target > 0 ? Math.min(100, (m.units_produced / target) * 100) : null };
    });
    // With targets: furthest behind first. Without: most made first.
    return list.sort((a, b) =>
      a.pct != null || b.pct != null ? (a.pct ?? 101) - (b.pct ?? 101) : b.units_produced - a.units_produced,
    );
  }, [data, machines, machineId, lineId, windowHours]);
  const anyTarget = rows.some((r) => r.pct != null);

  return (
    <ListGroup
      title="Machines"
      count={rows.length}
      hint={anyTarget ? 'Furthest behind target first' : 'Most made first'}
      action={
        <ExportCsvButton
          filename="machine-production"
          headers={['Machine', 'Line', 'Units Produced', 'Unit', 'Target', 'Sensor', 'Data Points']}
          rows={rows.map((m) => [
            m.machine_name,
            lineName.get(m.line_id) ?? m.line_id,
            m.units_produced,
            m.unit_label ?? 'units',
            m.target > 0 ? Math.round(m.target) : '',
            m.device_id,
            m.data_points,
          ])}
        />
      }
    >
      {rows.map((m) => (
        <ListRow
          key={m.machine_id}
          href={`/factories/${factoryId}/machines/${m.machine_id}`}
          tone={m.pct != null ? runTone(m.pct) : undefined}
          title={m.machine_name}
          tag={lineName.get(m.line_id) ?? m.line_id}
          detail={
            m.pct != null
              ? `${wholePercent(m.pct)} of target · target ${formatUnits(Math.round(m.target), m.unit_label)}`
              : 'No target set'
          }
          value={formatUnits(m.units_produced, m.unit_label)}
          valueHint="made"
        />
      ))}
    </ListGroup>
  );
}
