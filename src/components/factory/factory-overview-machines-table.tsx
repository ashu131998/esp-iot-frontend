'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQueries, useSuspenseQueries } from '@tanstack/react-query';

import { MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { LoadMore, useShowMore } from '@/components/ui/load-more';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction, offQuery } from '@/lib/display';
import { inBatches } from '@/lib/infinite';
import { useFactoryRefs, useShown } from '@/lib/factory-refs-context';
import { unitsMade } from '@/lib/overview-figures';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { useRefetchInterval } from '@/lib/refresh-context';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import { formatNumber, formatPercent, formatUnits, statusLabel } from '@/lib/utils';

const REFRESH_MS = 60_000;

/** Machines' last 24 hours (the table's strips), for a comma-separated batch of machine ids. */
function fetchUptime24h(factoryId: string, idsKey: string, signal: AbortSignal) {
  if (!idsKey) return Promise.resolve({ machines: [] });
  const now = new Date();
  const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  return api.uptime(factoryId, { from: from24h, to: now.toISOString(), machine_ids: idsKey }, { signal });
}

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

  // Infinite scroll: the first rows, then more as the table's end comes into view. Their figures are
  // all loaded at once; the 24-hour strips are worked out per machine, so they come a batch at a
  // time for the rows shown (the first batch with the page, each later one as it scrolls in).
  const total = scopedMachines.length;
  const { shown: rowsShown, more, hasMore } = useShowMore(total, [from ?? 'live', to ?? 'live', ...scopeKey].join('|'));
  const idBatches = useMemo(
    () => inBatches(scopedMachines.slice(0, rowsShown).map((m) => m.machine_id)),
    [scopedMachines, rowsShown],
  );
  const firstBatchKey = (idBatches[0] ?? []).join(',');

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
          queryKey: ['uptime-24h-overview', factoryId, firstBatchKey, ...scopeKey],
          queryFn: ({ signal }: { signal: AbortSignal }) => fetchUptime24h(factoryId, firstBatchKey, signal),
          refetchInterval,
          staleTime: 0,
        },
      ],
    });
  // Later batches: without holding up the rows already shown (their strips appear when they arrive).
  const laterUptime = useQueries({
    queries: idBatches.slice(1).map((ids) => {
      const idsKey = ids.join(',');
      return {
        queryKey: ['uptime-24h-overview', factoryId, idsKey, ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchUptime24h(factoryId, idsKey, signal),
        refetchInterval,
        staleTime: 0,
      };
    }),
  });
  const uptimeMachines = [...uptime24h.machines, ...laterUptime.flatMap((q) => q.data?.machines ?? [])];

  const uptimeByMachine = Object.fromEntries(
    uptimeMachines.map((m) => [m.machine_id, m]),
  );
  const uptimeRowsByMachine = Object.fromEntries(
    uptimeMachines.map((m) => [m.machine_id, expandUptimeMachines([m])]),
  );

  const machineRows = scopedMachines.map((m) => {
    const avail = availability.machines.find((a) => a.machine_id === m.machine_id);
    const eng = energy.machines.find((e) => e.machine_id === m.machine_id);
    const prod = production.machines.find((p) => p.machine_id === m.machine_id);
    const uptime = uptimeByMachine[m.machine_id];
    return { machine: m, avail, eng, prod, uptime };
  });

  const pageRows = machineRows.slice(0, rowsShown);

  // One rule for a machine's status now, in the table, the phone cards and the CSV.
  function machineStatus(
    uptime?: (typeof uptime24h.machines)[0],
    avail?: (typeof availability.machines)[0],
  ) {
    return uptime?.timeline.at(-1)?.status ?? avail?.status ?? 'no_data';
  }

  return (
    <Card>
      <CardHeader
        title="Machines"
        description="All machines registered for this factory"
        action={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
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
                ...(productionOn ? [unitsMade(prod)] : []),
                statusLabel(machineStatus(uptime, avail)),
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
      {/* Phones: one card per machine, tapping through to it. */}
      <ul className="-mx-4 divide-y border-t sm:hidden">
        {pageRows.map(({ machine, avail, eng, prod, uptime }) => (
            <li key={machine.machine_id}>
              <Link
                href={`/factories/${factoryId}/machines/${machine.machine_id}`}
                className="block px-4 py-3 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{machine.name}</p>
                    <p className="truncate text-xs text-muted">
                      {machine.line_id}
                      {machine.type && <span className="capitalize"> · {machine.type}</span>}
                    </p>
                  </div>
                  <MachineStatusBadge status={machineStatus(uptime, avail)} />
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <Figure label="Availability" value={formatPercent(avail?.availability_percent)} />
                  {energyOn && (
                    <Figure
                      label="Energy"
                      value={eng?.energy_kwh != null ? `${formatNumber(eng.energy_kwh)} kWh` : '—'}
                    />
                  )}
                  {productionOn && <Figure label="Units" value={formatUnits(unitsMade(prod), prod?.unit_label)} />}
                </dl>
              </Link>
            </li>
        ))}
      </ul>
      <Table className="hidden sm:block">
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
              {/* No production sensor, or no count received: "—", not "made 0". */}
              {productionOn && <TD>{formatUnits(unitsMade(prod), prod?.unit_label)}</TD>}
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
                <MachineStatusBadge status={machineStatus(uptime, avail)} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <LoadMore shown={rowsShown} total={total} hasMore={hasMore} onMore={more} />
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
