import { dehydrate, HydrationBoundary, type QueryClient } from '@tanstack/react-query';

import { DowntimeReportsCard } from '@/components/alerts/downtime-reports-card';
import { NotificationFeed } from '@/components/alerts/notification-feed';
import { MobileSettingsCard } from '@/components/alerts/mobile-settings-card';
import { FactoryAlertsDashboard } from '@/components/factory/factory-alerts-dashboard';
import { FactoryPageSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { canTestAlerts } from '@/lib/alert-settings';
import {
  DOWNTIME_REPORTS_LIMIT, FILTER_LINES_LIMIT, NOTIFICATIONS_LIMIT, TEST_WORKERS_LIMIT,
  alertsMachinesWindow, alertsQueryKeys, stopFollowUpWindow,
} from '@/lib/alerts-queries';
import { isShown } from '@/lib/display';
import { NavDim } from '@/lib/navigation-context';
import { getQueryClient } from '@/lib/get-query-client';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { serverApi } from '@/lib/server-api';
import { factoryPage } from '@/lib/server/factory-page';
import type { AlertSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Everything the page's sections show first is fetched here, together, so the page arrives whole.
 * Fetched one section at a time in the browser, each pushed the ones below it down as it came in.
 * The keys, windows and sizes are the sections' own (lib/alerts-queries.ts); a request that fails is
 * left to its section, which asks again in the browser.
 */
async function FactoryAlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ line_id?: string }>;
}) {
  const { factoryId } = await params;
  const { line_id: lineFilter = '' } = await searchParams;
  const display = await requireFactoryPage(factoryId, 'alerts');
  const show = (section: string) => isShown(display, `alerts.${section}`);

  const queryClient = getQueryClient();
  const keys = alertsQueryKeys;
  const wanted: Array<Promise<unknown>> = [];
  const fetchAhead = <T,>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => {
    wanted.push(queryClient.prefetchQuery({ queryKey, queryFn }));
  };

  let machinesKey: readonly unknown[] | null = null;
  if (show('machines')) {
    const factory = await serverApi.factory(factoryId);
    const maxDate = factory.data_limit?.until ?? null;
    machinesKey = keys.machines(factoryId, maxDate);
    fetchAhead(machinesKey, () => serverApi.availability(factoryId, alertsMachinesWindow(maxDate)));
    fetchAhead(keys.filterLines(factoryId), () => serverApi.lines(factoryId, FILTER_LINES_LIMIT, 0));
    fetchAhead(keys.filterMachines(factoryId, lineFilter), () => serverApi.machines(factoryId, lineFilter || undefined));
  }
  if (show('mobile')) {
    wanted.push(testWorkersAhead(queryClient, factoryId));
  }
  if (show('downtime')) {
    const followUp = stopFollowUpWindow();
    fetchAhead(keys.downtimeReports(factoryId), () => serverApi.downtimeReports(factoryId, DOWNTIME_REPORTS_LIMIT));
    fetchAhead(keys.downtimeReasons(factoryId), () => serverApi.downtimeReasons(factoryId));
    fetchAhead(keys.stopFollowUp(factoryId), () => serverApi.stopFollowUp(factoryId, followUp.from, followUp.to));
  }
  if (show('feed')) {
    fetchAhead(keys.notifications(factoryId), () => serverApi.notifications(factoryId, NOTIFICATIONS_LIMIT));
  }
  await Promise.all(wanted);
  // Drawn on the server only with its figures in hand: without them it would call the browser-only API here.
  const machinesReady = machinesKey !== null && queryClient.getQueryData(machinesKey) !== undefined;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <NavDim className="space-y-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          {show('machines') && (
            <QuerySuspense ssr={machinesReady} fallback={<FactoryPageSkeleton statCards={3} className="pt-0" />}>
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

export default factoryPage('alerts', FactoryAlertsPage);
