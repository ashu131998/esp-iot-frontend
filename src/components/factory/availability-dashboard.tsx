'use client';

import dynamic from 'next/dynamic';

import { AvailabilityCards } from '@/components/factory/availability-cards';
import { FactoryAvailabilityTrend } from '@/components/factory/factory-availability-trend';
import { ChartSkeleton, StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { useShown } from '@/lib/factory-refs-context';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';

const AvailabilityChartSection = dynamic(
  () => import('@/components/factory/availability-chart-section').then((m) => m.AvailabilityChartSection),
  { ssr: false },
);

const AvailabilityMachineTable = dynamic(
  () => import('@/components/factory/availability-machine-table').then((m) => m.AvailabilityMachineTable),
  { ssr: false },
);

export function AvailabilityDashboard({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { machineId } = useFactoryDateRange();
  // Parts our staff switched off for this factory are neither shown nor fetched.
  const shown = useShown();

  return (
    <>
      {/* Cards + shift section — resolves as soon as the availability query returns */}
      {shown('availability.cards') && (
        <QuerySuspense fallback={<StatGridSkeleton count={3} />}>
          <AvailabilityCards factoryId={factoryId} from={from} to={to} />
        </QuerySuspense>
      )}

      {/* Bar chart — lazy JS bundle, shares the cached availability query */}
      {shown('availability.chart') && (
        <QuerySuspense fallback={<ChartSkeleton />}>
          <AvailabilityChartSection factoryId={factoryId} from={from} to={to} />
        </QuerySuspense>
      )}

      {/* Daily trend — lazy JS bundle, own separate API call */}
      {!machineId && shown('availability.trend') && (
        <QuerySuspense fallback={<ChartSkeleton />}>
          <FactoryAvailabilityTrend factoryId={factoryId} from={from} to={to} />
        </QuerySuspense>
      )}

      {/* Machine table — lazy JS bundle, fires availability + uptime in parallel */}
      {shown('availability.table') && (
        <QuerySuspense fallback={<TableSkeleton rows={5} cols={7} />}>
          <AvailabilityMachineTable factoryId={factoryId} from={from} to={to} />
        </QuerySuspense>
      )}
    </>
  );
}
