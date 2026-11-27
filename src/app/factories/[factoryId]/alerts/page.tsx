import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import { NotificationFeed } from '@/components/alerts/notification-feed';
import { FactoryAlertsDashboard } from '@/components/factory/factory-alerts-dashboard';
import { FactoryPageSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import {
  FILTER_LINES_LIMIT, NOTIFICATIONS_LIMIT, alertsMachinesWindow, alertsQueryKeys,
} from '@/lib/alerts-queries';
import { isShown } from '@/lib/display';
import { isInternalStaff } from '@/lib/internal-auth';
import { NavDim } from '@/lib/navigation-context';
import { getQueryClient } from '@/lib/get-query-client';
import { factoryLinks } from '@/lib/server/factory-links';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { serverApi } from '@/lib/server-api';
import { factoryPage } from '@/lib/server/factory-page';
import { sessionUser } from '@/lib/server/session-user';

export const dynamic = 'force-dynamic';

/**
 * The factory's alerts, for our staff: which machines are stopped or have no signal, and the alerts sent. The
 * factory's own people have their alerts in the FloorBeat app's Alerts and the settings on Alert settings (the
 * owner, 2026-11-27: "no alert tab is necessary inside dashboard of factory users"), so this address takes them
 * there: an old link, and the "Alert settings" button of the board alert emails (query-api board-alert-mailer.js).
 *
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
  const user = await sessionUser();
  // who it is not told (the API slow to answer): the page, as before
  if (user && !isInternalStaff(user)) {
    const link = await factoryLinks(factoryId);
    return redirect(link(`/factories/${factoryId}/alert-settings`));
  }
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
          {show('feed') && <NotificationFeed factoryId={factoryId} />}
        </HydrationBoundary>
      </NavDim>
    </div>
  );
}

export default factoryPage('alerts', FactoryAlertsPage);
