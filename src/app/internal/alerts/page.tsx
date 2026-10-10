import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageHeader } from '@/components/layout/app-shell';
import { AlertsDashboard } from '@/components/alerts/alerts-dashboard';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { getQueryClient } from '@/lib/get-query-client';
import { serverApi } from '@/lib/server-api';

function AlertsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <StatGridSkeleton count={3} />
      <TableSkeleton rows={4} cols={3} />
    </div>
  );
}

export default async function AlertsPage() {
  const queryClient = getQueryClient();
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const factoriesData = await serverApi.factories();
  queryClient.setQueryData(['factories-for-alerts'], factoriesData);

  await Promise.all(
    factoriesData.factories.map((f) =>
      queryClient.prefetchQuery({
        queryKey: ['availability-alerts', f.factory_id],
        queryFn: () => serverApi.availability(f.factory_id, { from, to }),
      }),
    ),
  );

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Machine availability monitoring across all factories · refreshes every 60 s"
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <QuerySuspense fallback={<AlertsLoadingSkeleton />}>
            <AlertsDashboard />
          </QuerySuspense>
        </HydrationBoundary>
      </div>
    </>
  );
}
