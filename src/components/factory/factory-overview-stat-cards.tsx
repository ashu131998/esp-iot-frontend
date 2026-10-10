'use client';

import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Activity, Package, Zap } from 'lucide-react';

import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
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
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate), [from, to, minDate]);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const scopedMachines = useMemo(
    () => filterMachinesByScope(machines, { machineId, lineId }),
    [machines, machineId, lineId],
  );
  const refetchInterval = useRefetchInterval(REFRESH_MS);

  const [
    { data: availability, dataUpdatedAt: availabilityUpdatedAt },
    { data: energy },
    { data: production },
  ] = useSuspenseQueries({
    queries: [
      {
        queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.availability(factoryId, apiRange, { signal }),
        refetchInterval,
        staleTime: 0,
      },
      {
        queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.energy(factoryId, apiRange, { signal }),
        refetchInterval,
        staleTime: 0,
      },
      {
        queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.production(factoryId, apiRange, { signal }),
        refetchInterval,
        staleTime: 0,
      },
    ],
  });

  useSetRefreshInfo(availabilityUpdatedAt, REFRESH_SEC);

  const windowHours =
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / 3600000;
  const productionUnits = filterMachinesByScope(production.machines, { machineId, lineId }).reduce(
    (s, m) => s + m.units_produced,
    0,
  );
  const targetUnits = scopedMachines.reduce(
    (s, m) => s + (m.target_units_per_hour ?? 0) * windowHours,
    0,
  );
  const throughputPct =
    targetUnits > 0 ? Math.min(100, (productionUnits / targetUnits) * 100) : 0;
  const scopedAvailability = filterMachinesByScope(availability.machines, { machineId, lineId });
  const avgAvailability =
    scopedAvailability.length > 0
      ? scopedAvailability.reduce((s, m) => s + (m.availability_percent ?? 0), 0) /
        scopedAvailability.length
      : availability.avg_availability_percent;
  const performancePct =
    Math.round(((avgAvailability ?? 0) / 100) * (throughputPct / 100) * 1000) / 10;
  const totalEnergy = filterMachinesByScope(energy.machines, { machineId, lineId }).reduce(
    (s, m) => s + (m.energy_kwh ?? 0),
    0,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={`Availability (${rangeLabel})`}
        value={formatPercent(avgAvailability)}
        icon={<Activity className="h-4 w-4 text-muted" />}
      />
      <StatCard
        label={`Energy (${rangeLabel})`}
        value={`${formatNumber(totalEnergy)} kWh`}
        icon={<Zap className="h-4 w-4 text-muted" />}
      />
      <StatCard
        label="Units Produced"
        value={String(productionUnits)}
        icon={<Package className="h-4 w-4 text-muted" />}
      />
      <StatCard label="Performance" value={formatPercent(performancePct)} />
    </div>
  );
}
