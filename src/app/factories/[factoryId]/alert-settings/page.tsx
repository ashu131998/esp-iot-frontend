import { dehydrate, HydrationBoundary, type QueryClient } from '@tanstack/react-query';

import { DowntimeReportsCard } from '@/components/alerts/downtime-reports-card';
import { MobileSettingsCard } from '@/components/alerts/mobile-settings-card';
import { canTestAlerts } from '@/lib/alert-settings';
import { DOWNTIME_REPORTS_LIMIT, TEST_WORKERS_LIMIT, alertsQueryKeys, stopFollowUpWindow } from '@/lib/alerts-queries';
import { isShown } from '@/lib/display';
import { NavDim } from '@/lib/navigation-context';
import { getQueryClient } from '@/lib/get-query-client';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { serverApi } from '@/lib/server-api';
import { factoryPage } from '@/lib/server/factory-page';
import type { AlertSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Alert settings, under Manage (the owner, 2026-11-27): who gets push alerts and how, and the downtime reasons,
 * from the Alerts page, once the alerts themselves left the factory's dashboard for the FloorBeat app's Alerts.
 * The Alerts page's switches still say what shows (`alerts`, `alerts.mobile`, `alerts.downtime`). What each
 * section shows first is fetched here, together, so the page arrives whole (as the Alerts page does).
 */
async function AlertSettingsPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  const display = await requireFactoryPage(factoryId, 'alert-settings');
  const show = (section: string) => isShown(display, `alerts.${section}`);

  const queryClient = getQueryClient();
  const keys = alertsQueryKeys;
  const wanted: Array<Promise<unknown>> = [];
  if (show('mobile')) wanted.push(testWorkersAhead(queryClient, factoryId));
  if (show('downtime')) {
    const followUp = stopFollowUpWindow();
    wanted.push(
      queryClient.prefetchQuery({ queryKey: keys.downtimeReports(factoryId), queryFn: () => serverApi.downtimeReports(factoryId, DOWNTIME_REPORTS_LIMIT) }),
      queryClient.prefetchQuery({ queryKey: keys.downtimeReasons(factoryId), queryFn: () => serverApi.downtimeReasons(factoryId) }),
      queryClient.prefetchQuery({ queryKey: keys.stopFollowUp(factoryId), queryFn: () => serverApi.stopFollowUp(factoryId, followUp.from, followUp.to) }),
    );
  }
  await Promise.all(wanted);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <NavDim className="space-y-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          {show('mobile') && <MobileSettingsCard factoryId={factoryId} />}
          {show('downtime') && <DowntimeReportsCard factoryId={factoryId} />}
        </HydrationBoundary>
      </NavDim>
    </div>
  );
}

/** The alert settings, then the workers a test can go to when tests are possible at all (the card asks for them only then). */
async function testWorkersAhead(queryClient: QueryClient, factoryId: string): Promise<void> {
  const key = alertsQueryKeys.settings(factoryId);
  await queryClient.prefetchQuery({ queryKey: key, queryFn: () => serverApi.alertSettings(factoryId) });
  if (!canTestAlerts(queryClient.getQueryData<AlertSettings>(key))) return;
  await queryClient.prefetchQuery({
    queryKey: alertsQueryKeys.testWorkers(factoryId),
    queryFn: () => serverApi.workers(factoryId, TEST_WORKERS_LIMIT, 0, 'active'),
  });
}

export default factoryPage('alert-settings', AlertSettingsPage);
