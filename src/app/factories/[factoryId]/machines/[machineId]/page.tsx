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
          Lines
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
            <h2 className="text-2xl font-bold">{machine.name}</h2>
            {line && <p className="mt-1 text-sm text-muted">{line.name}</p>}
          </div>
          {machine.target_units_per_hour ? (
            <Badge className="shrink-0 bg-blue-50 text-blue-700">
              Should make {[machine.target_units_per_hour, machine.unit_label].filter(Boolean).join(' ')} an hour
            </Badge>
          ) : null}
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
