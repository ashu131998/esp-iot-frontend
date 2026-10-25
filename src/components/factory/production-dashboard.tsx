'use client';

import dynamic from 'next/dynamic';

import { ProductionCards } from '@/components/factory/production-cards';
import {
  ChartSkeleton,
  SingleStatChartTableSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { useShown } from '@/lib/factory-refs-context';

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
  // Parts our staff switched off for this factory are neither shown nor fetched.
  const shown = useShown();
  return (
    <QuerySuspense fallback={<SingleStatChartTableSkeleton tableCols={5} />}>
      {shown('production.cards') && <ProductionCards factoryId={factoryId} from={from} to={to} />}
      {shown('production.table') && <ProductionTable factoryId={factoryId} from={from} to={to} />}
      {shown('production.chart') && <ProductionChartSection factoryId={factoryId} from={from} to={to} />}
    </QuerySuspense>
  );
}
