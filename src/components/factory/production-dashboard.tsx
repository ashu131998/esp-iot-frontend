'use client';

import dynamic from 'next/dynamic';

import { ProductionCards } from '@/components/factory/production-cards';
import {
  ChartSkeleton,
  SingleStatChartTableSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const ProductionChartSection = dynamic(
  () => import('@/components/factory/production-chart-section').then((m) => m.ProductionChartSection),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const ProductionTable = dynamic(
  () => import('@/components/factory/production-table').then((m) => m.ProductionTable),
  { ssr: false, loading: () => <TableSkeleton rows={5} cols={5} /> },
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
    <QuerySuspense fallback={<SingleStatChartTableSkeleton tableCols={5} />}>
      <ProductionCards factoryId={factoryId} from={from} to={to} />
      <ProductionChartSection factoryId={factoryId} from={from} to={to} />
      <ProductionTable factoryId={factoryId} from={from} to={to} />
    </QuerySuspense>
  );
}
