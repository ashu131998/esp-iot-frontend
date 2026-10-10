import { MachineProfileManager } from '@/components/factory/machine-profile-manager';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { NavDim } from '@/lib/navigation-context';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function ConfigurationPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { factoryId } = await params;
  const [{ machines }, profilesData, configData] = await Promise.all([
    serverApi.machines(factoryId),
    serverApi.configProfiles(factoryId).catch(() => ({ profiles: [] as import('@/lib/types').MachineConfigProfile[] })),
    serverApi.configurations(factoryId, 200, 0).catch(() => ({ configurations: [] as import('@/lib/types').MachineConfiguration[] })),
  ]);

  const lastAppliedAt: Record<string, string> = {};
  for (const c of configData.configurations ?? []) {
    if (c.source === 'profile' && c.profile_id) {
      const prev = lastAppliedAt[c.profile_id];
      if (!prev || c.updated_at > prev) {
        lastAppliedAt[c.profile_id] = c.updated_at;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <DateRangeToolbar hideDateRange />
      </div>
      <NavDim className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        <MachineProfileManager
          factoryId={factoryId}
          machines={machines}
          profiles={profilesData.profiles ?? []}
          lastAppliedAt={lastAppliedAt}
        />
      </NavDim>
    </div>
  );
}
