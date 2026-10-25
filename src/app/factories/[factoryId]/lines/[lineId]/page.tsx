import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { LineStatusClient } from '@/components/factory/line-status-client';
import { LineMachineConfig } from '@/components/factory/line-machine-config';
import { isShown, noEnergy, noProduction } from '@/lib/display';
import { NavDim } from '@/lib/navigation-context';
import { resolveDateRange } from '@/lib/date-range';
import { getQueryClient } from '@/lib/get-query-client';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function LineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string; lineId: string }>;
  searchParams: Promise<{ from?: string; to?: string; machine_id?: string; line_id?: string }>;
}) {
  const { factoryId, lineId } = await params;
  const display = await requireFactoryPage(factoryId, 'lines');
  const sp = await searchParams;

  const factory = await serverApi.factory(factoryId);
  const range = resolveDateRange(sp, factory.created_at, factory.shifts);

  const activeLineId = sp.line_id ?? lineId;

  const [{ lines }, { machines: allMachines }, profilesData] = await Promise.all([
    serverApi.lines(factoryId),
    serverApi.machines(factoryId),
    serverApi.configProfiles(factoryId).catch(() => ({ profiles: [] as import('@/lib/types').MachineConfigProfile[] })),
  ]);

  const line = lines.find((l) => l.line_id === lineId);
  const lineMachines = allMachines.filter((m) => m.line_id === activeLineId);

  // Settings added on a machine are stored without a line_id, so a line filter alone misses them.
  const configPages = await Promise.all([
    serverApi.configurations(factoryId, 200, 0, undefined, activeLineId),
    ...lineMachines.map((m) => serverApi.configurations(factoryId, 200, 0, m.machine_id)),
  ]);
  const configurations = [
    ...new Map(configPages.flatMap((p) => p.configurations ?? []).map((c) => [c.config_id, c])).values(),
  ];

  const displayMachines = sp.machine_id
    ? lineMachines.filter((m) => m.machine_id === sp.machine_id)
    : lineMachines;

  // Prefetch live metrics so the client component renders immediately on first load
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['line-status', factoryId, activeLineId, sp.from ?? null, sp.to ?? null],
    queryFn: async () => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        serverApi.availability(factoryId, { ...range, line_id: activeLineId }),
        // Same switches as LineStatusClient, so the hydrated data matches its own requests.
        isShown(display, 'energy')
          ? serverApi.energy(factoryId, { ...range, line_id: activeLineId })
          : noEnergy(factoryId),
        isShown(display, 'production')
          ? serverApi.production(factoryId, { ...range, line_id: activeLineId })
          : noProduction(factoryId),
        serverApi.uptime(factoryId, { from: from24h, to: now.toISOString(), line_id: activeLineId }),
      ]);
      return { availability, energy, production, uptime24h };
    },
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link
          href={`/factories/${factoryId}/lines`}
          className="hover:underline hover:text-foreground transition-colors"
        >
          Lines
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{line?.name ?? lineId}</span>
      </nav>

      {line && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{line.name}</h2>
          </div>
          <Badge className="bg-blue-50 text-blue-700 shrink-0">
            {lineMachines.length} machine{lineMachines.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      <DateRangeToolbar
        minDate={factory.created_at}
        from={sp.from}
        to={sp.to}
        machines={allMachines}
        lines={lines}
        selectedLineId={activeLineId}
        selectedMachineId={sp.machine_id}
      />

      {/* Live metrics section — auto-refreshes every 60s */}
      <NavDim>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <QuerySuspense ssr
            fallback={
              <div className="space-y-6">
                <StatGridSkeleton count={3} />
                <TableSkeleton rows={lineMachines.length || 3} cols={4} />
              </div>
            }
          >
            <LineStatusClient
              factoryId={factoryId}
              lineId={activeLineId}
              machines={displayMachines}
              from={sp.from}
              to={sp.to}
              minDate={factory.created_at}
            />
          </QuerySuspense>
        </HydrationBoundary>
      </NavDim>

      {/* Operator configuration — static, doesn't need to auto-refresh */}
      <LineMachineConfig
        factoryId={factoryId}
        machines={lineMachines}
        configurations={configurations}
        profiles={profilesData.profiles ?? []}
      />
    </div>
  );
}
