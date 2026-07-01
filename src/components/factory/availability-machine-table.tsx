'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSuspenseQueries } from '@tanstack/react-query';

import { LiveStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { resolvePagination } from '@/lib/pagination';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { formatPercent, statusLabel } from '@/lib/utils';

export function AvailabilityMachineTable({
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

  // Both queries fire in parallel — availability and uptime no longer waterfall
  const [{ data }, { data: uptimeData }] = useSuspenseQueries({
    queries: [
      {
        queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live'],
        queryFn: ({ signal }: { signal: AbortSignal }) => api.availability(factoryId, range, { signal }),
        refetchInterval,
        staleTime: 0,
      },
      {
        queryKey: ['uptime-24h', factoryId, machineId ?? 'all'],
        queryFn: ({ signal }: { signal: AbortSignal }) => {
          const now = new Date();
          const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          return api.uptime(
            factoryId,
            { from: from24h, to: now.toISOString(), ...(machineId ? { machine_id: machineId } : {}) },
            { signal },
          );
        },
        refetchInterval,
        staleTime: 0,
      },
    ],
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
  const offset = (page - 1) * limit;
  const pageRows = displayMachines.slice(offset, offset + limit);

  const uptimeByMachine = Object.fromEntries(uptimeData.machines.map((m) => [m.machine_id, m]));

  return (
    <Card>
      <CardHeader
        title="Machine Availability"
        action={
          <ExportCsvButton
            filename="machine-availability"
            headers={['Machine', 'Line', 'Uptime (min)', 'Downtime (min)', 'Availability', 'Current Status']}
            rows={displayMachines.map((m) => [
              m.machine_name,
              m.line_id,
              m.uptime_minutes,
              m.downtime_minutes,
              m.availability_percent,
              statusLabel(uptimeByMachine[m.machine_id]?.timeline.at(-1)?.status ?? 'no_data'),
            ])}
          />
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Machine</TH>
            <TH>Line</TH>
            <TH>Uptime</TH>
            <TH>Downtime</TH>
            <TH>Availability</TH>
            <TH>Last 24h</TH>
            <TH>Current Status</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{m.line_id}</TD>
              <TD>{m.uptime_minutes} min</TD>
              <TD>{m.downtime_minutes} min</TD>
              <TD>{formatPercent(m.availability_percent)}</TD>
              <TD>
                <MiniTimeline segments={uptimeByMachine[m.machine_id]?.timeline ?? []} />
              </TD>
              <TD>
                <LiveStatusBadge status={uptimeByMachine[m.machine_id]?.timeline.at(-1)?.status ?? 'no_data'} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <TablePagination total={total} page={page} limit={limit} />
    </Card>
  );
}
