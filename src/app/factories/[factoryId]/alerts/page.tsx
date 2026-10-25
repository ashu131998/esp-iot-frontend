import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { DowntimeReportsCard } from '@/components/alerts/downtime-reports-card';
import { NotificationFeed } from '@/components/alerts/notification-feed';
import { MobileSettingsCard } from '@/components/alerts/mobile-settings-card';
import { FactoryAlertsDashboard } from '@/components/factory/factory-alerts-dashboard';
import { FactoryPageSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { isShown } from '@/lib/display';
import { NavDim } from '@/lib/navigation-context';
import { getQueryClient } from '@/lib/get-query-client';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { serverApi } from '@/lib/server-api';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function FactoryAlertsPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  const display = await requireFactoryPage(factoryId, 'alerts');
  const show = (section: string) => isShown(display, `alerts.${section}`);

  const queryClient = getQueryClient();
  const now = new Date();
  if (show('machines')) {
    await queryClient.prefetchQuery({
      queryKey: ['availability-factory-alerts', factoryId],
      queryFn: () =>
        serverApi.availability(factoryId, {
          from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          to: now.toISOString(),
        }),
    });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <NavDim className="space-y-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          {show('machines') && (
            <QuerySuspense ssr fallback={<FactoryPageSkeleton statCards={3} className="pt-0" />}>
              <FactoryAlertsDashboard factoryId={factoryId} />
            </QuerySuspense>
          )}
          {show('mobile') && <MobileSettingsCard factoryId={factoryId} />}
          {show('downtime') && <DowntimeReportsCard factoryId={factoryId} />}
          {show('feed') && <NotificationFeed factoryId={factoryId} />}
        </HydrationBoundary>
      </NavDim>
    </div>
  );
}

export default factoryPage('alerts', FactoryAlertsPage);
