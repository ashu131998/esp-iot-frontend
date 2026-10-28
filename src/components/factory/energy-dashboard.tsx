'use client';

import dynamic from 'next/dynamic';

import { EnergyCards } from '@/components/factory/energy-cards';
import {
  ChartSkeleton,
  SingleStatChartTableSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { useShown } from '@/lib/factory-refs-context';
import { useWideScreen } from '@/lib/use-wide-screen';

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
  // Parts our staff switched off for this factory are neither shown nor fetched.
  const shown = useShown();
  const wide = useWideScreen();
  return (
    <QuerySuspense fallback={<SingleStatChartTableSkeleton tableCols={6} />}>
      {shown('energy.cards') && <EnergyCards factoryId={factoryId} from={from} to={to} />}
      {wide && shown('energy.chart') && <EnergyChartSection factoryId={factoryId} from={from} to={to} />}
      {shown('energy.table') && <EnergyTable factoryId={factoryId} from={from} to={to} />}
    </QuerySuspense>
  );
}
