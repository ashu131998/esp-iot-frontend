'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { MetricBarChart } from '@/components/charts/metric-chart';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { unitsMade } from '@/lib/overview-figures';
import { sharedUnitLabel } from '@/lib/utils';

export function ProductionChartSection({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts, maxDate } = useFactoryRefs();
  const { t } = useT();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts, maxDate), [from, to, minDate, shifts, maxDate]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.production(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  // No production sensor: left off the chart; no count received: no bar. Neither is "made 0".
  const chartData = displayMachines
    .filter((m) => m.status !== 'no_sensor')
    .map((m) => ({ name: m.machine_name, units: unitsMade(m) }));
  const unit = sharedUnitLabel(displayMachines);
  const unitsLabel =
    unit === 'mixed'
      ? t('Units Produced (mixed units)')
      : unit
        ? t('Units Produced ({unit})', { unit })
        : t('Units Produced');

  return (
    <Card>
      <CardHeader title={t('Production by Machine')} description={t('Units counted from proximity sensor rising edges')} />
      <MetricBarChart
        data={chartData}
        bars={[{ key: 'units', color: '#2563eb', label: unitsLabel }]}
        showAllXLabels
        xLabelRotate={-45}
        height={360}
      />
    </Card>
  );
}
