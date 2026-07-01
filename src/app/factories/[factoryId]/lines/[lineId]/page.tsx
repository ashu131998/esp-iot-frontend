import Link from 'next/link';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { LineStatusClient } from '@/components/factory/line-status-client';
import { LineMachineConfig } from '@/components/factory/line-machine-config';
import { NavDim } from '@/lib/navigation-context';
import { resolveDateRange } from '@/lib/date-range';
import { getQueryClient } from '@/lib/get-query-client';
import { serverApi } from '@/lib/server-api';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string; lineId: string }>;
  searchParams: Promise<{ from?: string; to?: string; machine_id?: string }>;
}) {
  const { factoryId, lineId } = await params;
  const sp = await searchParams;

  const factory = await serverApi.factory(factoryId);
  const range = resolveDateRange(sp, factory.created_at);

  const [{ lines }, { machines }, configsData, profilesData] = await Promise.all([
    serverApi.lines(factoryId),
    serverApi.machines(factoryId, lineId),
    serverApi.configurations(factoryId, 200, 0, undefined, lineId),
    serverApi.configProfiles(factoryId).catch(() => ({ profiles: [] as import('@/lib/types').MachineConfigProfile[] })),
  ]);

  const line = lines.find((l) => l.line_id === lineId);

  // For the machine selector on this page, only show machines on this line
  const lineMachines = machines;
  // The lines list for grouping in the selector — just the current line is sufficient
  const lineForSelector = lines.filter((l) => l.line_id === lineId);

  // Filter machines to display if a specific machine is selected
  const displayMachines = sp.machine_id
    ? machines.filter((m) => m.machine_id === sp.machine_id)
    : machines;

  const configsByMachine = (configsData.configurations ?? []).reduce<Record<string, number>>(
    (acc, c) => {
      if (c.machine_id) acc[c.machine_id] = (acc[c.machine_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  // Prefetch live metrics so the client component renders immediately on first load
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['line-status', factoryId, lineId, sp.from ?? null, sp.to ?? null],
    queryFn: async () => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        serverApi.availability(factoryId, { ...range, line_id: lineId }),
        serverApi.energy(factoryId, { ...range, line_id: lineId }),
        serverApi.production(factoryId, { ...range, line_id: lineId }),
        serverApi.uptime(factoryId, { from: from24h, to: now.toISOString(), line_id: lineId }),
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
          Production Lines
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{line?.name ?? lineId}</span>
      </nav>

      {line && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{line.name}</h2>
            <p className="mt-0.5 font-mono text-xs text-muted">{line.line_id}</p>
            {line.last_seen_at && (
              <p className="mt-1 text-xs text-muted">Last seen {formatDate(line.last_seen_at)}</p>
            )}
          </div>
          <Badge className="bg-blue-50 text-blue-700 shrink-0">
            {machines.length} machine{machines.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      <DateRangeToolbar
        minDate={factory.created_at}
        from={sp.from}
        to={sp.to}
        machines={lineMachines}
        lines={lineForSelector}
        selectedMachineId={sp.machine_id}
      />

      {/* Live metrics section — auto-refreshes every 60s */}
      <NavDim>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <QuerySuspense
            fallback={
              <div className="space-y-6">
                <StatGridSkeleton count={3} />
                <TableSkeleton rows={machines.length || 3} cols={7} />
              </div>
            }
          >
            <LineStatusClient
              factoryId={factoryId}
              lineId={lineId}
              machines={displayMachines}
              configsByMachine={configsByMachine}
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
        machines={machines}
        configurations={configsData.configurations ?? []}
        profiles={profilesData.profiles ?? []}
      />
    </div>
  );
}
