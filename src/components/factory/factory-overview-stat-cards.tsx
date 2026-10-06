'use client';

import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Activity, Package, Zap } from 'lucide-react';

import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatNumber, formatPercent } from '@/lib/utils';

const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;

export function FactoryOverviewStatCards({
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

  const [
    { data: availability, dataUpdatedAt: availabilityUpdatedAt },
    { data: energy },
    { data: production },
  ] = useSuspenseQueries({
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
    ],
  });

  useSetRefreshInfo(availabilityUpdatedAt, REFRESH_SEC);

  const windowHours =
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / 3600000;
  const targetUnits = machines.reduce(
    (s, m) => s + (m.target_units_per_hour ?? 0) * windowHours,
    0,
  );
  const throughputPct =
    targetUnits > 0 ? Math.min(100, (production.total_units / targetUnits) * 100) : 0;
  const performancePct =
    Math.round(
      ((availability.avg_availability_percent ?? 0) / 100) * (throughputPct / 100) * 1000,
    ) / 10;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={`Availability (${rangeLabel})`}
        value={formatPercent(availability.avg_availability_percent)}
        icon={<Activity className="h-4 w-4 text-muted" />}
      />
      <StatCard
        label={`Energy (${rangeLabel})`}
        value={`${formatNumber(energy.total_energy_kwh)} kWh`}
        icon={<Zap className="h-4 w-4 text-muted" />}
      />
      <StatCard
        label="Units Produced"
        value={String(production.total_units)}
        icon={<Package className="h-4 w-4 text-muted" />}
      />
      <StatCard label="Performance" value={formatPercent(performancePct)} />
    </div>
  );
}
