import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { MachineStatusClient } from '@/components/factory/machine-status-client';
import { MachineConfigCard } from '@/components/factory/machine-config-card';
import { NavDim } from '@/lib/navigation-context';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function MachineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string; machineId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { factoryId, machineId } = await params;
  const sp = await searchParams;

  const factory = await serverApi.factory(factoryId);

  const [{ lines }, { machines }, configsData, profilesData] = await Promise.all([
    serverApi.lines(factoryId),
    serverApi.machines(factoryId),
    serverApi.configurations(factoryId, 200, 0, machineId).catch(() => ({
      configurations: [] as import('@/lib/types').MachineConfiguration[],
    })),
    serverApi.configProfiles(factoryId, machineId).catch(() => ({
      profiles: [] as import('@/lib/types').MachineConfigProfile[],
    })),
  ]);

  const machine = machines.find((m) => m.machine_id === machineId);
  const line = machine ? lines.find((l) => l.line_id === machine.line_id) : undefined;

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
        {line && (
          <>
            <span>/</span>
            <Link
              href={`/factories/${factoryId}/lines/${line.line_id}`}
              className="hover:underline hover:text-foreground transition-colors"
            >
              {line.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-medium text-foreground">{machine?.name ?? machineId}</span>
      </nav>

      {machine && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{machine.name}</h2>
            <p className="mt-0.5 font-mono text-xs text-muted">{machine.machine_id}</p>
            {machine.type && (
              <p className="mt-1 text-xs text-muted">Type: {machine.type}</p>
            )}
            {line && (
              <p className="mt-1 text-xs text-muted">Line: {line.name}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {machine.target_cycle_time_sec && (
              <Badge className="bg-green-50 text-green-700">
                Target Cycle: {machine.target_cycle_time_sec}s
              </Badge>
            )}
            {machine.target_units_per_hour && (
              <Badge className="bg-blue-50 text-blue-700">
                Target Units: {machine.target_units_per_hour}/hr
              </Badge>
            )}
          </div>
        </div>
      )}

      <DateRangeToolbar
        minDate={factory.created_at}
        from={sp.from}
        to={sp.to}
        hideMachineSelector
      />

      {/* Live metrics section — auto-refreshes every 60s */}
      <NavDim>
        <QuerySuspense
          fallback={
            <div className="space-y-6">
              <StatGridSkeleton count={3} />
              <TableSkeleton rows={5} cols={5} />
            </div>
          }
        >
          <MachineStatusClient
            factoryId={factoryId}
            machineId={machineId}
            from={sp.from}
            to={sp.to}
            minDate={factory.created_at}
          />
        </QuerySuspense>
      </NavDim>

      {/* Machine configuration */}
      {machine && (
        <MachineConfigCard
          factoryId={factoryId}
          machine={machine}
          configurations={configsData.configurations ?? []}
          profiles={profilesData.profiles ?? []}
        />
      )}
    </div>
  );
}
