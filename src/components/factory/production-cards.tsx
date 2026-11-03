'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Package } from 'lucide-react';

import { SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatUnits, sharedUnitLabel, sumUnits } from '@/lib/utils';
import { periodPhrase } from '@/lib/plain-words';

const PRODUCTION_REFRESH_MS = 60_000;
const PRODUCTION_REFRESH_SEC = 60;

export function ProductionCards({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts, maxDate } = useFactoryRefs();
  const { t, locale } = useT();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts, maxDate), [from, to, minDate, shifts, maxDate]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(PRODUCTION_REFRESH_MS);

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.production(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, PRODUCTION_REFRESH_SEC);

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const totalUnits = sumUnits(displayMachines);

  const unitLabel = sharedUnitLabel(displayMachines);
  const counted = displayMachines.filter((m) => m.status !== 'no_sensor');
  const top = [...counted].sort((a, b) => (b.units_produced ?? 0) - (a.units_produced ?? 0))[0];

  return (
    <SummaryCard
      tone="good"
      icon={<Package className="h-5 w-5" />}
      title={counted.length === 0
        ? t('No proximity sensor counts yet')
        : t('Made {units} in {period}', { units: formatUnits(totalUnits, unitLabel, locale, t('(mixed units)')), period: t(periodPhrase(from, to)) })}
      subtitle={top && (top.units_produced ?? 0) > 0
        ? `${t('Made the most: {machine} · {units}', { machine: top.machine_name, units: formatUnits(top.units_produced, top.unit_label, locale, t('(mixed units)')) })}${isFetching ? ` · ${t('updating…')}` : ''}`
        : t('From proximity sensor detections')}
    />
  );
}
