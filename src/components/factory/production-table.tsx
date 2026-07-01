'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { resolvePagination } from '@/lib/pagination';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';

export function ProductionTable({
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

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['production', factoryId, from ?? 'live', to ?? 'live'],
    queryFn: ({ signal }) => api.production(factoryId, range, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const searchParams = useSearchParams();
  const { page, limit } = resolvePagination({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  const total = displayMachines.length;
  const pageRows = displayMachines.slice((page - 1) * limit, (page - 1) * limit + limit);

  return (
    <Card>
      <CardHeader
        title="Machine Production"
        action={
          <div className="flex items-center gap-3">
            <ExportCsvButton
              filename="machine-production"
              headers={['Machine', 'Line', 'Units Produced', 'Sensor', 'Data Points']}
              rows={displayMachines.map((m) => [
                m.machine_name,
                m.line_id,
                m.units_produced,
                m.device_id,
                m.data_points,
              ])}
            />
          </div>
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Machine</TH>
            <TH>Line</TH>
            <TH>Units Produced</TH>
            <TH>Sensor</TH>
            <TH>Data Points</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{m.line_id}</TD>
              <TD className="font-semibold">{m.units_produced}</TD>
              <TD className="font-mono text-xs">{m.device_id ?? '—'}</TD>
              <TD>{m.data_points ?? '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <TablePagination total={total} page={page} limit={limit} />
    </Card>
  );
}
