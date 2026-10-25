'use client';

import dynamic from 'next/dynamic';

import { FactoryOverviewStatCards } from '@/components/factory/factory-overview-stat-cards';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { useShown } from '@/lib/factory-refs-context';

const FactoryOverviewMachinesTable = dynamic(
  () =>
    import('@/components/factory/factory-overview-machines-table').then(
      (m) => m.FactoryOverviewMachinesTable,
    ),
  { ssr: false, loading: () => <TableSkeleton rows={5} cols={8} /> },
);

export function FactoryOverviewDashboard({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const shown = useShown();
  return (
    <>
      {shown('overview.cards') && (
        <QuerySuspense fallback={<StatGridSkeleton count={4} />}>
          <FactoryOverviewStatCards factoryId={factoryId} from={from} to={to} />
        </QuerySuspense>
      )}

      {shown('overview.table') && (
        <QuerySuspense fallback={<TableSkeleton rows={5} cols={8} />}>
          <FactoryOverviewMachinesTable factoryId={factoryId} from={from} to={to} />
        </QuerySuspense>
      )}
    </>
  );
}
