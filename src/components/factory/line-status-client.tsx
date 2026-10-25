'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StatCard, MachineStatusBadge, Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction } from '@/lib/display';
import { useFactoryRefsOptional, useShown } from '@/lib/factory-refs-context';
import { unitsMade } from '@/lib/overview-figures';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import type {
  AvailabilityMachine,
  EnergyMachine,
  Machine,
  ProductionMachine,
  UptimeMachine,
} from '@/lib/types';
import { sortByMachineName } from '@/lib/machine-sort';
import { humanMinutes } from '@/lib/plain-words';
import { formatNumber, formatPercent, formatUnits } from '@/lib/utils';

const REFRESH_INTERVAL_MS = 60_000;
// Summary cards per row, by how many are shown (literal class names for Tailwind).
const GRID_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

export function LineStatusClient({
  factoryId,
  lineId,
  machines,
  configsByMachine,
  from,
  to,
  minDate,
}: {
  factoryId: string;
  lineId: string;
  machines: Machine[];
  configsByMachine: Record<string, number>;
  from?: string;
  to?: string;
  minDate?: string | null;
}) {
  const shifts = useFactoryRefsOptional()?.shifts;
  const range = useMemo(
    () => resolveDateRange({ from, to }, minDate, shifts),
    [from, to, minDate, shifts],
  );

  const refetchInterval = useRefetchInterval(REFRESH_INTERVAL_MS);
  // Energy / Production switched off for the factory: not requested, not shown.
  const shown = useShown();
  const energyOn = shown('energy');
  const productionOn = shown('production');

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['line-status', factoryId, lineId, from ?? null, to ?? null],
    queryFn: async ({ signal }) => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        api.availability(factoryId, { ...range, line_id: lineId }, { signal }),
        energyOn ? api.energy(factoryId, { ...range, line_id: lineId }, { signal }) : noEnergy(factoryId),
        productionOn
          ? api.production(factoryId, { ...range, line_id: lineId }, { signal })
          : noProduction(factoryId),
        api.uptime(factoryId, { from: from24h, to: now.toISOString(), line_id: lineId }, { signal }),
      ]);
      return { availability, energy, production, uptime24h };
    },
    refetchInterval,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_INTERVAL_MS / 1000);

  const { availability, energy, production, uptime24h } = data;

  const lineMachineCount = availability.machines.length;
  const lineUptimeMin =
    lineMachineCount > 0 ? availability.total_uptime_minutes / lineMachineCount : 0;
  const lineDowntimeMin =
    lineMachineCount > 0 ? availability.total_downtime_minutes / lineMachineCount : 0;

  const machineRows = useMemo(() => sortByMachineName(machines), [machines]);

  const availByMachine = availability.machines.reduce<Record<string, AvailabilityMachine>>(
    (acc, m) => { acc[m.machine_id] = m; return acc; },
    {},
  );
  const energyByMachine = energy.machines.reduce<Record<string, EnergyMachine>>(
    (acc, m) => { acc[m.machine_id] = m; return acc; },
    {},
  );
  const productionByMachine = production.machines.reduce<Record<string, ProductionMachine>>(
    (acc, m) => { acc[m.machine_id] = m; return acc; },
    {},
  );
  const uptimeByMachine = uptime24h.machines.reduce<Record<string, UptimeMachine>>(
    (acc, m) => { acc[m.machine_id] = m; return acc; },
    {},
  );

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 ${GRID_COLS[1 + Number(energyOn) + Number(productionOn)]}`}>
        {energyOn && (
          <StatCard
            label="Total Energy"
            value={`${formatNumber(energy.total_energy_kwh)} kWh`}
            sub="Estimated from current sensors"
          />
        )}
        <StatCard
          label="Avg Availability"
          value={formatPercent(availability.avg_availability_percent)}
          sub={`${humanMinutes(lineUptimeMin)} running · ${humanMinutes(lineDowntimeMin)} stopped (avg per machine)`}
        />
        {productionOn && (
          <StatCard
            label="Units Produced"
            value={formatUnits(production.total_units, production.unit_label)}
            sub="From proximity sensor detections"
          />
        )}
      </div>

      <Card>
        <CardHeader
          title="Machine Status"
          description={`Timeline shows last 24h${isFetching ? ' · updating…' : ''}`}
        />

        {machineRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No machines on this line.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Machine</TH>
                <TH>Current Status</TH>
                {productionOn && <TH>Units Produced</TH>}
                {energyOn && <TH>Energy (kWh)</TH>}
                <TH>Availability</TH>
                <TH>Last 24h</TH>
                <TH>Config Entries</TH>
              </TR>
            </THead>
            <TBody>
              {machineRows.map((machine) => {
                const avail = availByMachine[machine.machine_id];
                const eng = energyByMachine[machine.machine_id];
                const prod = productionByMachine[machine.machine_id];
                const uptime = uptimeByMachine[machine.machine_id];
                const cfgCount = configsByMachine[machine.machine_id] ?? 0;
                // Current status from the 24h timeline (Running / Stopped / No signal).
                const status = uptime?.timeline.at(-1)?.status ?? 'no_data';

                return (
                  <TR key={machine.machine_id}>
                    <TD className="font-medium">
                      <Link
                        href={`/factories/${machine.factory_id}/machines/${machine.machine_id}`}
                        className="hover:underline text-blue-600"
                      >
                        {machine.name}
                      </Link>
                    </TD>
                    <TD>
                      <MachineStatusBadge status={status} />
                    </TD>
                    {productionOn && (
                      <TD className="font-semibold">{formatUnits(unitsMade(prod), prod?.unit_label)}</TD>
                    )}
                    {energyOn && (
                      <TD>
                        {eng?.energy_kwh != null ? `${formatNumber(eng.energy_kwh)} kWh` : '—'}
                      </TD>
                    )}
                    <TD>{formatPercent(avail?.availability_percent ?? null)}</TD>
                    <TD>
                      <MiniTimeline segments={uptime?.timeline ?? []} />
                    </TD>
                    <TD>
                      {cfgCount > 0 ? (
                        <Badge className="bg-blue-50 text-blue-700">{cfgCount}</Badge>
                      ) : (
                        <span className="text-xs text-muted">None</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
