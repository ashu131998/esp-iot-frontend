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
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction, offQuery } from '@/lib/display';
import { useFactoryRefs, useShown } from '@/lib/factory-refs-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { useRefetchInterval } from '@/lib/refresh-context';
import { useClientPagination } from '@/lib/use-client-pagination';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import { formatNumber, formatPercent, formatUnits, statusLabel } from '@/lib/utils';

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
  const { minDate, machines, shifts } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const scopedMachines = useMemo(
    () => filterMachinesByScope(machines, { machineId, lineId }),
    [machines, machineId, lineId],
  );
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  // Modules switched off for the factory: their columns are not requested or shown.
  const shown = useShown();
  const energyOn = shown('energy');
  const productionOn = shown('production');

  const { page, limit, offset, setPaginationParams } = useClientPagination();

  const pageMachineIds = useMemo(
    () => scopedMachines.slice(offset, offset + limit).map((m) => m.machine_id),
    [scopedMachines, offset, limit],
  );
  const pageMachineIdsKey = pageMachineIds.join(',');

  const [{ data: availability }, { data: energy }, { data: production }, { data: uptime24h }] =
    useSuspenseQueries({
      queries: [
        {
          queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            api.availability(factoryId, apiRange, { signal }),
          refetchInterval,
          staleTime: 0,
        },
        energyOn
          ? {
            queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
            queryFn: ({ signal }: { signal: AbortSignal }) =>
              api.energy(factoryId, apiRange, { signal }),
            refetchInterval,
            staleTime: 0,
          }
          : offQuery('energy', noEnergy(factoryId)),
        productionOn
          ? {
            queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
            queryFn: ({ signal }: { signal: AbortSignal }) =>
              api.production(factoryId, apiRange, { signal }),
            refetchInterval,
            staleTime: 0,
          }
          : offQuery('production', noProduction(factoryId)),
        {
          queryKey: ['uptime-24h-overview', factoryId, page, limit, pageMachineIdsKey, ...scopeKey],
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

  const machineRows = scopedMachines.map((m) => {
    const avail = availability.machines.find((a) => a.machine_id === m.machine_id);
    const eng = energy.machines.find((e) => e.machine_id === m.machine_id);
    const prod = production.machines.find((p) => p.machine_id === m.machine_id);
    const uptime = uptimeByMachine[m.machine_id];
    return { machine: m, avail, eng, prod, uptime };
  });

  const pageRows = machineRows.slice(offset, offset + limit);
  const total = scopedMachines.length;

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
        description="All machines registered for this factory"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              filename="factory-machines"
              headers={[
                'Machine',
                'Line',
                'Type',
                'Availability',
                ...(energyOn ? ['Energy (kWh)'] : []),
                ...(productionOn ? ['Units'] : []),
                'Current Status',
              ]}
              rows={machineRows.map(({ machine, avail, eng, prod, uptime }) => [
                machine.name,
                machine.line_id,
                machine.type,
                avail?.availability_percent,
                ...(energyOn ? [eng?.energy_kwh] : []),
                ...(productionOn ? [prod?.units_produced ?? 0] : []),
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
            {energyOn && <TH>Energy</TH>}
            {productionOn && <TH>Units</TH>}
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
              {energyOn && (
                <TD>{eng?.energy_kwh != null ? `${formatNumber(eng.energy_kwh)} kWh` : '—'}</TD>
              )}
              {productionOn && <TD>{formatUnits(prod?.units_produced ?? 0, prod?.unit_label)}</TD>}
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
