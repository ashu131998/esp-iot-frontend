'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StatCard, LiveStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { MachineAvailabilityTrends } from '@/components/factory/machine-availability-trends';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatNumber, formatPercent } from '@/lib/utils';

const REFRESH_INTERVAL_MS = 60_000;

export function MachineStatusClient({
  factoryId,
  machineId,
  from,
  to,
  minDate,
}: {
  factoryId: string;
  machineId: string;
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
    queryKey: ['machine-status', factoryId, machineId, from ?? null, to ?? null],
    queryFn: async ({ signal }) => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        api.availability(factoryId, { ...range, machine_id: machineId }, { signal }),
        api.energy(factoryId, { ...range, machine_id: machineId }, { signal }),
        api.production(factoryId, { ...range, machine_id: machineId }, { signal }),
        api.uptime(factoryId, { from: from24h, to: now.toISOString(), machine_id: machineId }, { signal }),
      ]);
      return { availability, energy, production, uptime24h };
    },
    refetchInterval,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_INTERVAL_MS / 1000);

  const { availability, energy, production, uptime24h } = data;

  const machineAvail = availability.machines[0];
  const machineEnergy = energy.machines[0];
  const machineProduction = production.machines[0];
  const machineUptime = uptime24h.machines[0];
  const status = machineUptime?.timeline.at(-1)?.status ?? 'no_data';

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Total Energy (${rangeLabel})`}
          value={`${formatNumber(machineEnergy?.energy_kwh ?? 0)} kWh`}
          sub={machineEnergy?.avg_amps != null ? `Avg: ${formatNumber(machineEnergy.avg_amps)}A` : 'No data'}
        />
        <StatCard
          label={`Availability (${rangeLabel})`}
          value={formatPercent(machineAvail?.availability_percent ?? null)}
          sub={`${formatNumber(machineAvail?.uptime_minutes ?? 0, 0)}m up · ${formatNumber(machineAvail?.downtime_minutes ?? 0, 0)}m down`}
        />
        <StatCard
          label={`Units Produced (${rangeLabel})`}
          value={String(machineProduction?.units_produced ?? 0)}
          sub="From proximity sensor detections"
        />
      </div>

      {/* Machine status card */}
      <Card>
        <CardHeader
          title="Current Status"
          description={`${rangeLabel} · timeline shows last 24h${isFetching ? ' · updating…' : ''}`}
        />
        <div className="px-6 py-4">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3">
            <span className="text-sm font-medium">Status</span>
            <div className="flex justify-end"><LiveStatusBadge status={status} /></div>
            <span className="text-sm font-medium">Timeline (Last 24h)</span>
            <MiniTimeline segments={machineUptime?.timeline ?? []} />
          </div>
        </div>
      </Card>

      {/* Lazy-loaded availability trends */}
      <MachineAvailabilityTrends
        factoryId={factoryId}
        machineId={machineId}
        from={from}
        to={to}
      />
    </div>
  );
}
