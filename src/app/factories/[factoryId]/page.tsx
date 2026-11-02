import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { FactoryOverviewDashboard } from '@/components/factory/factory-overview-dashboard';
import { resolveDateRange } from '@/lib/date-range';
import { isShown } from '@/lib/display';
import { getQueryClient } from '@/lib/get-query-client';
import { NavDim } from '@/lib/navigation-context';
import { overviewQueryKey } from '@/lib/overview-queries';
import { resultsSummaryQueryKey, setupProgressQueryKey } from '@/lib/results';
import { factoryPage } from '@/lib/server/factory-page';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { serverApi } from '@/lib/server-api';
import { DEFAULT_SHIFTS } from '@/lib/shifts';

export const dynamic = 'force-dynamic';

/**
 * The factory's landing page. Its figures are fetched here, on the server, so the first screen on a
 * phone arrives with real numbers instead of a skeleton that waits for the browser's JavaScript; the
 * stat cards then take over and refresh them (lib/overview-queries.ts keeps the two in step). The
 * machine table still loads in the browser (its 24-hour strips come in batches).
 */
async function FactoryOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string; line_id?: string; machine_id?: string; page?: string; limit?: string }>;
}) {
  const { factoryId } = await params;
  const sp = await searchParams;
  const display = await requireFactoryPage(factoryId, 'overview');
  const factory = await serverApi.factory(factoryId);
  const shifts = factory.shifts?.length ? factory.shifts : DEFAULT_SHIFTS;

  const scope = { from: sp.from, to: sp.to, lineId: sp.line_id, machineId: sp.machine_id };
  const range = resolveDateRange({ from: sp.from, to: sp.to }, factory.created_at, shifts);
  // The same request the cards make: the line narrows the server's answer, the machine is a client-side filter.
  const apiRange = { ...range, ...(sp.line_id ? { line_id: sp.line_id } : {}) };
  const show = (key: string) => isShown(display, key);

  const queryClient = getQueryClient();
  // The rollout checklist and this month's recovered hours, fetched alongside the stat cards so
  // neither card pops in after the first paint (and neither holds the page up on its own).
  const extraCards = Promise.all([
    show('overview.setup')
      ? queryClient.prefetchQuery({ queryKey: setupProgressQueryKey(factoryId), queryFn: () => serverApi.setupProgress(factoryId) })
      : null,
    show('results') && show('overview.recovered')
      ? queryClient.prefetchQuery({ queryKey: resultsSummaryQueryKey(factoryId), queryFn: () => serverApi.resultsSummary(factoryId) })
      : null,
  ]);
  let ssrCards = false;
  if (show('overview.cards')) {
    const wanted: Array<{ key: readonly unknown[]; fetch: () => Promise<unknown> }> = [
      { key: overviewQueryKey('availability', factoryId, scope), fetch: () => serverApi.availability(factoryId, apiRange) },
      ...(show('energy') ? [{ key: overviewQueryKey('energy', factoryId, scope), fetch: () => serverApi.energy(factoryId, apiRange) }] : []),
      ...(show('production') ? [{ key: overviewQueryKey('production', factoryId, scope), fetch: () => serverApi.production(factoryId, apiRange) }] : []),
      ...(show('production') && show('performance')
        ? [{ key: overviewQueryKey('performance', factoryId, scope), fetch: () => serverApi.performance(factoryId, apiRange) }]
        : []),
    ];
    await Promise.all(wanted.map((w) => queryClient.prefetchQuery({ queryKey: w.key, queryFn: w.fetch })));
    // Only with every figure in hand: one missing would have the browser-only API called while rendering here.
    ssrCards = wanted.every((w) => queryClient.getQueryData(w.key) !== undefined);
  }
  await extraCards;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <DateRangeToolbar from={sp.from} to={sp.to} />
      <NavDim className="space-y-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FactoryOverviewDashboard factoryId={factoryId} from={sp.from} to={sp.to} ssrCards={ssrCards} />
        </HydrationBoundary>
      </NavDim>
    </div>
  );
}

export default factoryPage('overview', FactoryOverviewPage);
