import { SchedulingPanel } from '@/components/factory/scheduling-panel';
import { PageHeader } from '@/components/layout/app-shell';
import { NavDim } from '@/lib/navigation-context';
import { serverApi } from '@/lib/server-api';
import type {
  MachineConfigProfile,
  ProductionLine,
  Worker,
  WorkerSchedule,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SchedulingPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  const [{ machines }, linesData, profilesData, workersData, schedulesData] = await Promise.all([
    serverApi.machines(factoryId),
    serverApi.lines(factoryId, 100, 0).catch(() => ({ lines: [] as ProductionLine[] })),
    serverApi
      .configProfiles(factoryId)
      .catch(() => ({ profiles: [] as MachineConfigProfile[] })),
    serverApi.workers(factoryId, 200, 0).catch(() => ({ workers: [] as Worker[] })),
    serverApi.schedules(factoryId, 200, 0).catch(() => ({ schedules: [] as WorkerSchedule[] })),
  ]);

  return (
    <NavDim>
      <PageHeader
        title="Scheduling"
        description="Plan worker tasks across shifts, dates, looms and machine configuration profiles"
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <SchedulingPanel
          factoryId={factoryId}
          workers={workersData.workers ?? []}
          machines={machines}
          lines={linesData.lines ?? []}
          profiles={profilesData.profiles ?? []}
          schedules={schedulesData.schedules ?? []}
        />
      </div>
    </NavDim>
  );
}
