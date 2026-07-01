'use client';

import { useSearchParams } from 'next/navigation';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { api } from '@/lib/api';
import { resolvePagination } from '@/lib/pagination';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { formatPercent } from '@/lib/utils';

export function PerformanceTable({ factoryId }: { factoryId: string }) {
  const { range, live, machineId } = useFactoryDateRange();
  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['performance', factoryId, live ? 'live' : range.from, live ? 'live' : range.to],
    queryFn: ({ signal }) => api.performance(factoryId, range, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const allMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const searchParams = useSearchParams();
  const { page, limit } = resolvePagination({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  const total = allMachines.length;
  const offset = (page - 1) * limit;
  const pageRows = allMachines.slice(offset, offset + limit);

  return (
    <Card>
      <CardHeader
        title="Machine Performance"
        action={
          <ExportCsvButton
            filename="machine-performance"
            headers={['Machine', 'Line', 'Performance (P)', 'Availability (A)', 'Throughput (A×P)', 'Units Produced', 'Target Units', 'Cycle Target (s)']}
            rows={allMachines.map((m) => [
              m.machine_name,
              m.line_id,
              m.performance_percent,
              m.availability_percent,
              m.throughput_percent,
              m.units_produced,
              m.target_units,
              m.target_cycle_time_sec,
            ])}
          />
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Machine</TH>
            <TH>Line</TH>
            <TH>Performance (P)</TH>
            <TH>Availability (A)</TH>
            <TH>Throughput (A × P)</TH>
            <TH>Units / Target</TH>
            <TH>Cycle Target</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{m.line_id}</TD>
              <TD>{formatPercent(m.performance_percent)}</TD>
              <TD>{formatPercent(m.availability_percent)}</TD>
              <TD>{formatPercent(m.throughput_percent)}</TD>
              <TD>
                {m.units_produced} / {m.target_units}
              </TD>
              <TD>{m.target_cycle_time_sec ? `${m.target_cycle_time_sec}s` : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <TablePagination total={total} page={page} limit={limit} />
    </Card>
  );
}
