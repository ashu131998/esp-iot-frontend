import { MachineProfileManager } from '@/components/factory/machine-profile-manager';
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
    <NavDim className="p-4 sm:p-6 lg:p-8">
      <MachineProfileManager
        factoryId={factoryId}
        machines={machines}
        profiles={profilesData.profiles ?? []}
        lastAppliedAt={lastAppliedAt}
      />
    </NavDim>
  );
}
