'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { ListGroup, ListRow } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatNumber } from '@/lib/utils';

export function EnergyTable({
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

  const { data } = useSuspenseQuery({
    queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.energy(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const lineName = useMemo(() => new Map(lines.map((l) => [l.line_id, l.name])), [lines]);
  const rows = useMemo(
    () =>
      [...filterMachinesByScope(data.machines, { machineId, lineId })].sort(
        (a, b) => (b.energy_kwh ?? -1) - (a.energy_kwh ?? -1),
      ),
    [data, machineId, lineId],
  );
  const total = rows.reduce((s, m) => s + (m.energy_kwh ?? 0), 0);

  return (
    <ListGroup
      title="Machines"
      count={rows.length}
      hint="Most power first"
      action={
        <ExportCsvButton
          filename="machine-energy"
          headers={['Machine', 'Line', 'Energy (kWh)', 'Avg Amps', 'Peak Amps', 'Voltage (V)']}
          rows={rows.map((m) => [
            m.machine_name,
            lineName.get(m.line_id) ?? m.line_id,
            m.energy_kwh,
            m.avg_amps,
            m.peak_amps,
            m.voltage_v,
          ])}
        />
      }
    >
      {rows.map((m) => (
        <ListRow
          key={m.machine_id}
          href={`/factories/${factoryId}/machines/${m.machine_id}`}
          title={m.machine_name}
          tag={lineName.get(m.line_id) ?? m.line_id}
          detail={
            m.energy_kwh == null
              ? 'No power reading'
              : total > 0
                ? `${Math.round((m.energy_kwh / total) * 100)}% of all power used`
                : 'Used no power'
          }
          value={m.energy_kwh != null ? `${formatNumber(m.energy_kwh)} kWh` : '—'}
          valueHint="used"
        />
      ))}
    </ListGroup>
  );
}
