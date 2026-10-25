'use client';

import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Activity, Package, Zap } from 'lucide-react';

import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noPerformance, noProduction, offQuery } from '@/lib/display';
import { useFactoryRefs, useShown } from '@/lib/factory-refs-context';
import { overviewFigures } from '@/lib/overview-figures';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatNumber, formatPercent, formatUnits } from '@/lib/utils';

const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;
// Cards per row on wide screens, by how many are shown (literal class names for Tailwind).
const LG_COLS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

export function FactoryOverviewStatCards({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  // Modules switched off for the factory: their data is not requested, their cards not shown.
  const shown = useShown();
  const energyOn = shown('energy');
  const productionOn = shown('production');
  const performanceOn = productionOn && shown('performance');

  const [
    { data: availability, dataUpdatedAt: availabilityUpdatedAt },
    { data: energy },
    { data: production },
    { data: performance },
  ] = useSuspenseQueries({
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
      performanceOn
        ? {
          queryKey: ['performance', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            api.performance(factoryId, apiRange, { signal }),
          refetchInterval,
          staleTime: 0,
        }
        : offQuery('performance', noPerformance(factoryId)),
    ],
  });

  useSetRefreshInfo(availabilityUpdatedAt, REFRESH_SEC);

  const scope = { machineId, lineId };
  const figures = overviewFigures({
    availability: filterMachinesByScope(availability.machines, scope),
    production: filterMachinesByScope(production.machines, scope),
    energy: filterMachinesByScope(energy.machines, scope),
    performance: filterMachinesByScope(performance.machines, scope),
  });

  const cards = 1 + Number(energyOn) + Number(productionOn) + Number(performanceOn);

  return (
    <div className={`grid gap-4 ${cards > 1 ? 'sm:grid-cols-2' : ''} ${LG_COLS[cards]}`}>
      <StatCard
        label="Availability"
        value={formatPercent(figures.runningPercent)}
        icon={<Activity className="h-4 w-4 text-muted" />}
      />
      {energyOn && (
        <StatCard
          label="Energy"
          value={figures.kwh != null ? `${formatNumber(figures.kwh)} kWh` : '—'}
          icon={<Zap className="h-4 w-4 text-muted" />}
        />
      )}
      {productionOn && (
        <StatCard
          label="Units Produced"
          value={formatUnits(figures.units, figures.unitLabel)}
          icon={<Package className="h-4 w-4 text-muted" />}
        />
      )}
      {performanceOn && <StatCard label="Performance" value={formatPercent(figures.onTargetPercent)} />}
    </div>
  );
}
