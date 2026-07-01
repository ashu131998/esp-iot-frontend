import { TeamPanel } from '@/components/factory/team-panel';
import { PageHeader } from '@/components/layout/app-shell';
import { resolvePagination, resolveListTotal } from '@/lib/pagination';
import { NavDim } from '@/lib/navigation-context';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function FactoryTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const { factoryId } = await params;
  const sp = await searchParams;
  const pagination = resolvePagination({ page: sp.page, limit: sp.limit });

  const [pendingData, usersData] = await Promise.all([
    serverApi.factoryUsers(factoryId, 100, 0, 'pending'),
    serverApi.factoryUsers(factoryId, pagination.limit, pagination.offset),
  ]);

  return (
    <NavDim>
      <PageHeader title="Team" description="Manage employee access and approvals" />
      <TeamPanel
        factoryId={factoryId}
        pendingUsers={pendingData.users ?? []}
        pendingTotal={resolveListTotal(
          pendingData.total,
          pendingData.users?.length ?? 0,
          100,
          0,
        )}
        users={usersData.users ?? []}
        total={resolveListTotal(
          usersData.total,
          usersData.users?.length ?? 0,
          pagination.limit,
          pagination.offset,
        )}
        page={pagination.page}
        limit={pagination.limit}
      />
    </NavDim>
  );
}
