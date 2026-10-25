'use client';

import { FactoryOverviewSimple } from '@/components/factory/factory-overview-simple';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

export function FactoryOverviewDashboard({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  return (
    <QuerySuspense
      fallback={
        <div className="space-y-6">
          <StatGridSkeleton count={4} />
          <TableSkeleton rows={5} cols={4} />
        </div>
      }
    >
      <FactoryOverviewSimple factoryId={factoryId} from={from} to={to} />
    </QuerySuspense>
  );
}
