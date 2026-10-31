'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { PHONE_HIDDEN, TBody, TD, THead, TH, TR } from '@/components/ui/table';
import { LoadMore, ScrollTable, useShowMore } from '@/components/ui/load-more';
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
import { formatNumber, formatVolts } from '@/lib/utils';

export function EnergyTable({
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

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.energy(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const total = displayMachines.length;
  // Infinite scroll: the first rows, then more as the table's end comes into view (all are loaded).
  const listKey = [from, to, ...scopeKey].join('|');
  const { shown, more, hasMore } = useShowMore(total, listKey);
  const pageRows = displayMachines.slice(0, shown);

  return (
    <Card>
      <CardHeader
        title="Machine Energy Details"
        action={
          <div className="flex items-center gap-3">
            <ExportCsvButton
              filename="machine-energy"
              headers={['Machine', 'Line', 'Energy (kWh)', 'Avg Amps', 'Peak Amps', 'Voltage (V)']}
              rows={displayMachines.map((m) => [
                m.machine_name,
                m.line_id,
                m.energy_kwh,
                m.avg_amps,
                m.peak_amps,
                m.voltage_v,
              ])}
            />
          </div>
        }
      />
      <ScrollTable rowCount={pageRows.length} resetKey={listKey}>
        <THead>
          <TR>
            <TH>Machine</TH>
            <TH>Line</TH>
            <TH>Energy (kWh)</TH>
            <TH className={PHONE_HIDDEN}>Avg Amps</TH>
            <TH className={PHONE_HIDDEN}>Peak Amps</TH>
            <TH>Voltage</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{m.line_id}</TD>
              <TD>{m.energy_kwh != null ? formatNumber(m.energy_kwh) : '—'}</TD>
              <TD className={PHONE_HIDDEN}>{m.avg_amps != null ? formatNumber(m.avg_amps, 2) : '—'}</TD>
              <TD className={PHONE_HIDDEN}>{m.peak_amps != null ? formatNumber(m.peak_amps, 2) : '—'}</TD>
              <TD>{formatVolts(m.voltage_v)}</TD>
            </TR>
          ))}
        </TBody>
      </ScrollTable>
      <LoadMore shown={shown} total={total} hasMore={hasMore} onMore={more} />
    </Card>
  );
}
