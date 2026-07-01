'use client';

import dynamic from 'next/dynamic';

import { ProductionCards } from '@/components/factory/production-cards';
import { ChartSkeleton, StatCardSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const ProductionChartSection = dynamic(
  () => import('@/components/factory/production-chart-section').then((m) => m.ProductionChartSection),
  { ssr: false },
);

const ProductionTable = dynamic(
  () => import('@/components/factory/production-table').then((m) => m.ProductionTable),
  { ssr: false },
);

export function ProductionDashboard({
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
        <ProductionCards factoryId={factoryId} from={from} to={to} />
      </QuerySuspense>

      <QuerySuspense fallback={<ChartSkeleton />}>
        <ProductionChartSection factoryId={factoryId} from={from} to={to} />
      </QuerySuspense>

      <QuerySuspense fallback={<TableSkeleton rows={5} cols={5} />}>
        <ProductionTable factoryId={factoryId} from={from} to={to} />
      </QuerySuspense>
    </>
  );
}
