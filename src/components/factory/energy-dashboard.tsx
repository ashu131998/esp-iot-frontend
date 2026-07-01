'use client';

import dynamic from 'next/dynamic';

import { EnergyCards } from '@/components/factory/energy-cards';
import {
  ChartSkeleton,
  SingleStatChartTableSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const EnergyChartSection = dynamic(
  () => import('@/components/factory/energy-chart-section').then((m) => m.EnergyChartSection),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const EnergyTable = dynamic(
  () => import('@/components/factory/energy-table').then((m) => m.EnergyTable),
  { ssr: false, loading: () => <TableSkeleton rows={5} cols={6} /> },
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
    <QuerySuspense fallback={<SingleStatChartTableSkeleton tableCols={6} />}>
      <EnergyCards factoryId={factoryId} from={from} to={to} />
      <EnergyChartSection factoryId={factoryId} from={from} to={to} />
      <EnergyTable factoryId={factoryId} from={from} to={to} />
    </QuerySuspense>
  );
}
