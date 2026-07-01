'use client';

import dynamic from 'next/dynamic';

import { PerformanceCards } from '@/components/factory/performance-cards';
import {
  ChartSkeleton,
  SingleStatChartTableSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const PerformanceChartSection = dynamic(
  () => import('@/components/factory/performance-chart-section').then((m) => m.PerformanceChartSection),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const PerformanceTable = dynamic(
  () => import('@/components/factory/performance-table').then((m) => m.PerformanceTable),
  { ssr: false, loading: () => <TableSkeleton rows={5} cols={7} /> },
);

export function PerformanceDashboard({ factoryId }: { factoryId: string }) {
  return (
    <QuerySuspense fallback={<SingleStatChartTableSkeleton tableCols={7} />}>
      <PerformanceCards factoryId={factoryId} />
      <PerformanceChartSection factoryId={factoryId} />
      <PerformanceTable factoryId={factoryId} />
    </QuerySuspense>
  );
}
