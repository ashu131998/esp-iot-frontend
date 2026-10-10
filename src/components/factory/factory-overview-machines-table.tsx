'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';

import { MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useClientPagination } from '@/lib/use-client-pagination';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import { formatNumber, formatPercent, statusLabel } from '@/lib/utils';

const REFRESH_MS = 60_000;

export function FactoryOverviewMachinesTable({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, machines } = useFactoryRefs();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate), [from, to, minDate]);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const refetchInterval = useRefetchInterval(REFRESH_MS);

  const { page, limit, offset, setPaginationParams } = useClientPagination();

  const pageMachineIds = useMemo(
    () => machines.slice(offset, offset + limit).map((m) => m.machine_id),
    [machines, offset, limit],
  );
  const pageMachineIdsKey = pageMachineIds.join(',');

  const [{ data: availability }, { data: energy }, { data: production }, { data: uptime24h }] =
    useSuspenseQueries({
      queries: [
        {
          queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live'],
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            api.availability(factoryId, range, { signal }),
          refetchInterval,
          staleTime: 0,
        },
        {
          queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live'],
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            api.energy(factoryId, range, { signal }),
          refetchInterval,
          staleTime: 0,
        },
        {
          queryKey: ['production', factoryId, from ?? 'live', to ?? 'live'],
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            api.production(factoryId, range, { signal }),
          refetchInterval,
          staleTime: 0,
        },
        {
          queryKey: ['uptime-24h-overview', factoryId, page, limit, pageMachineIdsKey],
          queryFn: ({ signal }: { signal: AbortSignal }) => {
            if (pageMachineIds.length === 0) {
              return Promise.resolve({ machines: [] });
            }
            const now = new Date();
            const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            return api.uptime(
              factoryId,
              {
                from: from24h,
                to: now.toISOString(),
                machine_ids: pageMachineIdsKey,
              },
              { signal },
            );
          },
          refetchInterval,
          staleTime: 0,
        },
      ],
    });

  const uptimeByMachine = Object.fromEntries(
    uptime24h.machines.map((m) => [m.machine_id, m]),
  );
  const uptimeRowsByMachine = Object.fromEntries(
    uptime24h.machines.map((m) => [m.machine_id, expandUptimeMachines([m])]),
  );

  const machineRows = machines.map((m) => {
    const avail = availability.machines.find((a) => a.machine_id === m.machine_id);
    const eng = energy.machines.find((e) => e.machine_id === m.machine_id);
    const prod = production.machines.find((p) => p.machine_id === m.machine_id);
    const uptime = uptimeByMachine[m.machine_id];
    return { machine: m, avail, eng, prod, uptime };
  });

  const pageRows = machineRows.slice(offset, offset + limit);
  const total = machines.length;

  function currentStatus(
    uptime?: (typeof uptime24h.machines)[0],
    avail?: (typeof availability.machines)[0],
  ) {
    return statusLabel(uptime?.timeline.at(-1)?.status ?? avail?.status ?? 'no_data');
  }

  return (
    <Card>
      <CardHeader
        title="Machines"
        description={`All machines registered for this factory · ${rangeLabel}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              filename="factory-machines"
              headers={[
                'Machine',
                'Line',
                'Type',
                'Availability',
                'Energy (kWh)',
                'Units',
                'Current Status',
              ]}
              rows={machineRows.map(({ machine, avail, eng, prod, uptime }) => [
                machine.name,
                machine.line_id,
                machine.type,
                avail?.availability_percent,
                eng?.energy_kwh,
                prod?.units_produced ?? 0,
                currentStatus(uptime, avail),
              ])}
            />
            <Link
              href={`/factories/${factoryId}/configuration`}
              className="text-sm text-primary hover:underline"
            >
              Manage config →
            </Link>
          </div>
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Machine</TH>
            <TH>Line</TH>
            <TH>Type</TH>
            <TH>Availability</TH>
            <TH>Energy</TH>
            <TH>Units</TH>
            <TH>Last 24h</TH>
            <TH>Current Status</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map(({ machine, avail, eng, prod, uptime }) => (
            <TR key={machine.machine_id}>
              <TD className="font-medium">{machine.name}</TD>
              <TD>{machine.line_id}</TD>
              <TD className="capitalize">{machine.type}</TD>
              <TD>{formatPercent(avail?.availability_percent)}</TD>
              <TD>{eng?.energy_kwh != null ? `${formatNumber(eng.energy_kwh)} kWh` : '—'}</TD>
              <TD>{prod?.units_produced ?? 0}</TD>
              <TD>
                {(uptimeRowsByMachine[machine.machine_id]?.length ?? 0) > 1 ? (
                  <div className="flex flex-col gap-1">
                    {uptimeRowsByMachine[machine.machine_id]?.map((row) => (
                      <div key={row.stream_key} className="flex items-center gap-2">
                        <span className="max-w-[6rem] truncate text-[10px] text-muted">{row.label || row.display_name}</span>
                        <MiniTimeline segments={row.timeline ?? []} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <MiniTimeline segments={uptime?.timeline ?? []} />
                )}
              </TD>
              <TD>
                <MachineStatusBadge
                  status={uptime?.timeline.at(-1)?.status ?? avail?.status ?? 'no_data'}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <TablePagination
        total={total}
        page={page}
        limit={limit}
        onPaginationChange={setPaginationParams}
      />
    </Card>
  );
}
