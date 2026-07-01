'use client';

import dynamic from 'next/dynamic';

import { EnergyCards } from '@/components/factory/energy-cards';
import { ChartSkeleton, StatCardSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const EnergyChartSection = dynamic(
  () => import('@/components/factory/energy-chart-section').then((m) => m.EnergyChartSection),
  { ssr: false },
);

const EnergyTable = dynamic(
  () => import('@/components/factory/energy-table').then((m) => m.EnergyTable),
  { ssr: false },
);

export function EnergyDashboard({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  return (
    <>
      <QuerySuspense fallback={<StatCardSkeleton />}>
        <EnergyCards factoryId={factoryId} from={from} to={to} />
      </QuerySuspense>

      <QuerySuspense fallback={<ChartSkeleton />}>
        <EnergyChartSection factoryId={factoryId} from={from} to={to} />
      </QuerySuspense>

      <QuerySuspense fallback={<TableSkeleton rows={5} cols={6} />}>
        <EnergyTable factoryId={factoryId} from={from} to={to} />
      </QuerySuspense>
    </>
  );
}
