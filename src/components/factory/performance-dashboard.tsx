'use client';

import dynamic from 'next/dynamic';

import { PerformanceCards } from '@/components/factory/performance-cards';
import { ChartSkeleton, StatCardSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const PerformanceChartSection = dynamic(
  () => import('@/components/factory/performance-chart-section').then((m) => m.PerformanceChartSection),
  { ssr: false },
);

const PerformanceTable = dynamic(
  () => import('@/components/factory/performance-table').then((m) => m.PerformanceTable),
  { ssr: false },
);

export function PerformanceDashboard({ factoryId }: { factoryId: string }) {
  return (
    <>
      <QuerySuspense fallback={<StatCardSkeleton />}>
        <PerformanceCards factoryId={factoryId} />
      </QuerySuspense>

      <QuerySuspense fallback={<ChartSkeleton />}>
        <PerformanceChartSection factoryId={factoryId} />
      </QuerySuspense>

      <QuerySuspense fallback={<TableSkeleton rows={5} cols={7} />}>
        <PerformanceTable factoryId={factoryId} />
      </QuerySuspense>
    </>
  );
}
