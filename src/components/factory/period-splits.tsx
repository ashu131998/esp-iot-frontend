'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { SplitCard } from '@/components/charts/donut-chart';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs, useLineName } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';
import { overviewQueryKey } from '@/lib/overview-queries';
import { lineEnergySlices, machineEnergySlices, runShareSlices, timeSplitSlices } from '@/lib/pie-slices';
import { humanMinutes, periodPhrase } from '@/lib/plain-words';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange, factoryScopeQueryKey, filterMachinesByScope, useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatUpTo } from '@/lib/format';

const REFRESH_MS = 60_000;

/** The period and scope of the page, as the cards beside these pies ask for them (same queries, so no second fetch). */
function usePeriod(from?: string, to?: string) {
  const { minDate, shifts, maxDate } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts, maxDate), [from, to, minDate, shifts, maxDate]);
  return {
    machineId, lineId,
    scopeKey: factoryScopeQueryKey({ machineId, lineId }),
    apiRange: factoryMetricsApiRange(range, { machineId, lineId }),
    refetchInterval: useRefetchInterval(REFRESH_MS),
  };
}

/** Overview: how many machines ran 85 % or more of the period, 70–85 %, under 70 %, or have no data. */
export function OverviewRunSplit({ factoryId, from, to }: { factoryId: string; from?: string; to?: string }) {
  const { t, tn, locale } = useT();
  const { machineId, lineId, apiRange, refetchInterval } = usePeriod(from, to);
  const { data } = useSuspenseQuery({
    queryKey: overviewQueryKey('availability', factoryId, { from, to, lineId, machineId }),
    queryFn: ({ signal }) => api.availability(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const machines = filterMachinesByScope(data.machines, { machineId, lineId });
  if (machines.length < 2) return null;
  return (
    <SplitCard
      title={t('Machines by running time')}
      description={t('How much of {period} each machine ran', { period: t(periodPhrase(from, to)) })}
      slices={runShareSlices(machines.map((m) => m.availability_percent), t)}
      format={(n) => tn(n, '{count} machine', '{count} machines', { count: n })}
      locale={locale}
    />
  );
}

/** Availability: the period's running time against its stopped time, over the machines shown. */
export function AvailabilitySplit({ factoryId, from, to }: { factoryId: string; from?: string; to?: string }) {
  const { t, locale } = useT();
  const { machineId, lineId, scopeKey, apiRange, refetchInterval } = usePeriod(from, to);
  const { data } = useSuspenseQuery({
    queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.availability(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const machines = filterMachinesByScope(data.machines, { machineId, lineId });
  const up = machines.reduce((s, m) => s + m.uptime_minutes, 0);
  const down = machines.reduce((s, m) => s + m.downtime_minutes, 0);
  return (
    <SplitCard
      title={t('Running vs stopped')}
      description={machines.length > 1 ? t('All machines together, {period}', { period: t(periodPhrase(from, to)) }) : t(periodPhrase(from, to))}
      slices={timeSplitSlices(up, down, t)}
      format={(n) => humanMinutes(n, t)}
      locale={locale}
      empty={t('No running data yet')}
    />
  );
}

/** Energy: each line's share of the period's kWh; on one line's page, each machine's. Not for one machine. */
export function EnergySplit({ factoryId, from, to }: { factoryId: string; from?: string; to?: string }) {
  const { t, locale } = useT();
  const lineName = useLineName();
  const { machineId, lineId, scopeKey, apiRange, refetchInterval } = usePeriod(from, to);
  const { data } = useSuspenseQuery({
    queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.energy(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  if (machineId) return null;
  const machines = filterMachinesByScope(data.machines, { machineId, lineId });
  const byLine = !lineId && new Set(machines.map((m) => m.line_id)).size > 1;
  return (
    <SplitCard
      title={byLine ? t('Energy by line') : t('Energy by machine')}
      description={t(periodPhrase(from, to))}
      slices={byLine ? lineEnergySlices(machines, lineName) : machineEnergySlices(machines, t)}
      format={(n) => `${formatUpTo(n, 1, locale)} kWh`}
      locale={locale}
      empty={t('No energy measured in this period')}
    />
  );
}
