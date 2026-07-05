import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { DowntimeReportsCard } from '@/components/alerts/downtime-reports-card';
import { NotificationFeed } from '@/components/alerts/notification-feed';
import { MobileSettingsCard } from '@/components/alerts/mobile-settings-card';
import { FactoryAlertsDashboard } from '@/components/factory/factory-alerts-dashboard';
import { FactoryPageSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { NavDim } from '@/lib/navigation-context';
import { getQueryClient } from '@/lib/get-query-client';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function FactoryAlertsPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  const queryClient = getQueryClient();
  const now = new Date();
  await queryClient.prefetchQuery({
    queryKey: ['availability-factory-alerts', factoryId],
    queryFn: () =>
      serverApi.availability(factoryId, {
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      }),
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <NavDim className="space-y-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <QuerySuspense fallback={<FactoryPageSkeleton statCards={3} className="pt-0" />}>
            <FactoryAlertsDashboard factoryId={factoryId} />
          </QuerySuspense>
          <div className="grid gap-6 xl:grid-cols-2">
            <MobileSettingsCard factoryId={factoryId} />
            <DowntimeReportsCard factoryId={factoryId} />
          </div>
          <NotificationFeed factoryId={factoryId} />
        </HydrationBoundary>
      </NavDim>
    </div>
  );
}
