'use client';

import dynamic from 'next/dynamic';

import { PerformanceCards } from '@/components/factory/performance-cards';
import {
  ChartSkeleton,
  SingleStatChartTableSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { useShown } from '@/lib/factory-refs-context';

const PerformanceChartSection = dynamic(
  () => import('@/components/factory/performance-chart-section').then((m) => m.PerformanceChartSection),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const PerformanceTable = dynamic(
  () => import('@/components/factory/performance-table').then((m) => m.PerformanceTable),
  { ssr: false, loading: () => <TableSkeleton rows={5} cols={7} /> },
);

export function PerformanceDashboard({ factoryId }: { factoryId: string }) {
  // Parts our staff switched off for this factory are neither shown nor fetched.
  const shown = useShown();
  return (
    <QuerySuspense fallback={<SingleStatChartTableSkeleton tableCols={7} />}>
      {shown('performance.cards') && <PerformanceCards factoryId={factoryId} />}
      {shown('performance.table') && <PerformanceTable factoryId={factoryId} />}
      {shown('performance.chart') && <PerformanceChartSection factoryId={factoryId} />}
    </QuerySuspense>
  );
}
