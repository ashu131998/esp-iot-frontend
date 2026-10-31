'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { LoadMore, ScrollTable } from '@/components/ui/load-more';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { WorkerRoster } from '@/components/factory/worker-roster';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { useInfiniteList, type ListPage } from '@/lib/use-infinite-list';
import type { AuthUser } from '@/lib/auth-types';
import type { Worker } from '@/lib/types';

export function TeamPanel({
  factoryId,
  workers,
  pendingUsers,
  pendingTotal,
  firstUsers,
}: {
  factoryId: string;
  workers: Worker[];
  pendingUsers: AuthUser[];
  pendingTotal: number;
  /** The first users, rendered on the server; more load as the list scrolls (useInfiniteList). */
  firstUsers: ListPage<AuthUser>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canWriteFactory } = useAuth();
  const { items: users, total, hasMore, more, loading } = useInfiniteList<AuthUser>({
    queryKey: ['factory-users-list', factoryId],
    first: firstUsers,
    fetchPage: ({ limit, offset, signal }) =>
      api.factoryUsers(factoryId, { limit, offset }, { signal }).then((r) => ({ items: r.users ?? [], total: r.total ?? 0 })),
  });

  const approve = useMutation({
    mutationFn: (userId: string) => api.approveUser(factoryId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['factory-users-list', factoryId] });
      router.refresh();
    },
  });

  async function fetchPendingRows() {
    const allPending = await fetchAllPages(({ limit: pageLimit, offset }) =>
      api.factoryUsers(factoryId, { limit: pageLimit, offset, status: 'pending' }).then((r) => ({
        items: r.users,
        total: r.total,
      })),
    );
    return allPending.map((u) => [u.username, u.email, u.status]);
  }

  async function fetchAllUserRows() {
    const allUsers = await fetchAllPages(({ limit: pageLimit, offset }) =>
      api.factoryUsers(factoryId, { limit: pageLimit, offset }).then((r) => ({
        items: r.users,
        total: r.total,
      })),
    );
    return allUsers.map((u) => [u.username, u.role, u.status]);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <WorkerRoster factoryId={factoryId} workers={workers} readOnly={!canWriteFactory} />

      <Card className="p-6">
        <CardHeader
          title="Pending approvals"
          description="Employees awaiting access to this factory"
          action={
            <ExportCsvButton
              filename="pending-approvals"
              headers={['Username', 'Email', 'Status']}
              fetchRows={fetchPendingRows}
              rowCount={pendingTotal}
            />
          }
        />
        {pendingUsers.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No pending employee signups.</p>
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Username</TH>
                <TH>Email</TH>
                <TH>Status</TH>
                {canWriteFactory && <TH />}
              </TR>
            </THead>
            <TBody>
              {pendingUsers.map((u) => (
                <TR key={u.user_id}>
                  <TD>{u.username}</TD>
                  <TD>{u.email ?? '—'}</TD>
                  <TD>
                    <Badge>{u.status}</Badge>
                  </TD>
                  {canWriteFactory && (
                    <TD>
                      <Button
                        size="sm"
                        onClick={() => approve.mutate(u.user_id)}
                        disabled={approve.isPending}
                      >
                        Approve
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader
          title="All factory users"
          action={
            <ExportCsvButton
              filename="factory-users"
              headers={['Username', 'Role', 'Status']}
              fetchRows={fetchAllUserRows}
              rowCount={total}
            />
          }
        />
        {users.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No users found.</p>
        ) : (
          <>
            <ScrollTable className="mt-4 border-0" rowCount={users.length}>
              <THead>
                <TR>
                  <TH>Username</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u.user_id}>
                    <TD>{u.username}</TD>
                    <TD>{u.role}</TD>
                    <TD>{u.status}</TD>
                  </TR>
                ))}
              </TBody>
            </ScrollTable>
            <LoadMore shown={users.length} total={total} hasMore={hasMore} onMore={more} loading={loading} />
          </>
        )}
      </Card>
    </div>
  );
}
