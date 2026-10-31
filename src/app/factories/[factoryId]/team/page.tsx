import { TeamPanel } from '@/components/factory/team-panel';
import { PageHeader } from '@/components/layout/app-shell';
import { SCROLL_STEP } from '@/lib/infinite';
import { resolveListTotal } from '@/lib/pagination';
import { NavDim } from '@/lib/navigation-context';
import { serverApi } from '@/lib/server-api';
import type { Worker } from '@/lib/types';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function FactoryTeamPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;

  const [pendingData, usersData, workersData] = await Promise.all([
    serverApi.factoryUsers(factoryId, 100, 0, 'pending'),
    serverApi.factoryUsers(factoryId, SCROLL_STEP, 0),   // the first users; more load as the list scrolls
    serverApi.workers(factoryId, 200, 0).catch(() => ({ workers: [] as Worker[] })),
  ]);

  return (
    <NavDim>
      <PageHeader
        title="Team"
        description="Floor workers (scheduling and mobile alerts) and dashboard user access"
      />
      <TeamPanel
        factoryId={factoryId}
        workers={workersData.workers ?? []}
        pendingUsers={pendingData.users ?? []}
        pendingTotal={resolveListTotal(
          pendingData.total,
          pendingData.users?.length ?? 0,
          100,
          0,
        )}
        firstUsers={{
          items: usersData.users ?? [],
          total: resolveListTotal(usersData.total, usersData.users?.length ?? 0, SCROLL_STEP, 0),
        }}
      />
    </NavDim>
  );
}

export default factoryPage('team', FactoryTeamPage);
