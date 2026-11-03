import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { ResultsDashboard } from '@/components/results/results-dashboard';
import { getQueryClient } from '@/lib/get-query-client';
import { NavDim } from '@/lib/navigation-context';
import { resultsQueryKey } from '@/lib/results';
import { factoryPage } from '@/lib/server/factory-page';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Results: what Machine Monitoring as a Service gave the factory back in a month (machine-hours won
 * back against the first month, their worth against the fee, stop follow-up). Printable as the
 * monthly report. `?month=YYYY-MM` opens a month (the monthly email links here), `?settings=1` the
 * settings (from the rollout checklist).
 */
async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ month?: string; settings?: string }>;
}) {
  const { factoryId } = await params;
  const sp = await searchParams;
  const month = sp.month && MONTH_RE.test(sp.month) ? sp.month : undefined;
  const factory = await serverApi.factory(factoryId);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: resultsQueryKey(factoryId, month ?? null),
    queryFn: () => serverApi.results(factoryId, month),
  });

  return (
    <NavDim className="space-y-6 p-4 sm:p-6 lg:p-8">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ResultsDashboard
          factoryId={factoryId}
          factoryName={factory.name}
          location={factory.location}
          initialMonth={month}
          openSettings={sp.settings === '1'}
        />
      </HydrationBoundary>
    </NavDim>
  );
}

export default factoryPage('results', ResultsPage);
