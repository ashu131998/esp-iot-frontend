'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/ui/page-skeletons';

const AvailabilityTrendChart = dynamic(
  () => import('@/components/factory/availability-trend-chart').then(m => ({ default: m.AvailabilityTrendChart })),
  { ssr: false, loading: () => <div className="h-96 bg-muted rounded animate-pulse" /> }
);

const AvailabilityTrendTable = dynamic(
  () => import('@/components/factory/availability-trend-table').then(m => ({ default: m.AvailabilityTrendTable })),
  { ssr: false, loading: () => <TableSkeleton rows={7} cols={5} /> }
);

const MachinePerformanceTrend = dynamic(
  () => import('@/components/factory/machine-performance-trend').then(m => ({ default: m.MachinePerformanceTrend })),
  { ssr: false, loading: () => <div className="h-96 bg-muted rounded animate-pulse" /> }
);

export function MachineAvailabilityTrends({
  factoryId,
  machineId,
  from,
  to,
}: {
  factoryId: string;
  machineId: string;
  from?: string;
  to?: string;
}) {
  return (
    <>
      <Suspense fallback={<div className="h-96 bg-muted rounded animate-pulse" />}>
        <AvailabilityTrendChart
          factoryId={factoryId}
          machineId={machineId}
          from={from}
          to={to}
        />
      </Suspense>

      <Suspense fallback={<div className="h-96 bg-muted rounded animate-pulse" />}>
        <MachinePerformanceTrend
          factoryId={factoryId}
          machineId={machineId}
          from={from}
          to={to}
        />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={7} cols={5} />}>
        <AvailabilityTrendTable
          factoryId={factoryId}
          machineId={machineId}
          from={from}
          to={to}
        />
      </Suspense>
    </>
  );
}
