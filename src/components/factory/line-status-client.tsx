'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StatCard, LiveStatusBadge, Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import type {
  AvailabilityMachine,
  EnergyMachine,
  Machine,
  ProductionMachine,
  UptimeMachine,
} from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/utils';

const REFRESH_INTERVAL_MS = 60_000;

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
  const range = useMemo(
    () => resolveDateRange({ from, to }, minDate),
    [from, to, minDate],
  );
  const rangeLabel = formatRangeLabel(range.from, range.to);

  const refetchInterval = useRefetchInterval(REFRESH_INTERVAL_MS);

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['line-status', factoryId, lineId, from ?? null, to ?? null],
    queryFn: async ({ signal }) => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        api.availability(factoryId, { ...range, line_id: lineId }, { signal }),
        api.energy(factoryId, { ...range, line_id: lineId }, { signal }),
        api.production(factoryId, { ...range, line_id: lineId }, { signal }),
        api.uptime(factoryId, { from: from24h, to: now.toISOString(), line_id: lineId }, { signal }),
      ]);
      return { availability, energy, production, uptime24h };
    },
    refetchInterval,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_INTERVAL_MS / 1000);

  const { availability, energy, production, uptime24h } = data;

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
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Total Energy (${rangeLabel})`}
          value={`${formatNumber(energy.total_energy_kwh)} kWh`}
          sub="Estimated from current sensors"
        />
        <StatCard
          label={`Avg Availability (${rangeLabel})`}
          value={formatPercent(availability.avg_availability_percent)}
          sub={`${formatNumber(availability.total_uptime_minutes, 0)} min running · ${formatNumber(availability.total_downtime_minutes, 0)} min stopped`}
        />
        <StatCard
          label={`Units Produced (${rangeLabel})`}
          value={String(production.total_units)}
          sub="From proximity sensor detections"
        />
      </div>

      <Card>
        <CardHeader
          title="Machine Status"
          description={`Metrics for ${rangeLabel} · timeline shows last 24h${isFetching ? ' · updating…' : ''}`}
        />

        {machines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No machines on this line.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Machine</TH>
                <TH>Current Status</TH>
                <TH>Units Produced</TH>
                <TH>Energy (kWh)</TH>
                <TH>Availability</TH>
                <TH>Last 24h</TH>
                <TH>Config Entries</TH>
              </TR>
            </THead>
            <TBody>
              {machines.map((machine) => {
                const avail = availByMachine[machine.machine_id];
                const eng = energyByMachine[machine.machine_id];
                const prod = productionByMachine[machine.machine_id];
                const uptime = uptimeByMachine[machine.machine_id];
                const cfgCount = configsByMachine[machine.machine_id] ?? 0;
                // Current status = most recent state from the 24h timeline, not the
                // day's availability-computation status (which is 'computed' whenever
                // any data exists and would wrongly show an offline loom as "Live").
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
                      <LiveStatusBadge status={status} />
                    </TD>
                    <TD className="font-semibold">{prod?.units_produced ?? '—'}</TD>
                    <TD>
                      {eng?.energy_kwh != null ? `${formatNumber(eng.energy_kwh)} kWh` : '—'}
                    </TD>
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
