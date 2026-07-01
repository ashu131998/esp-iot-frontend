'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { TablePagination } from '@/components/ui/table-pagination';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { AuthUser } from '@/lib/auth-types';

export function TeamPanel({
  factoryId,
  pendingUsers,
  pendingTotal,
  users,
  total,
  page,
  limit,
}: {
  factoryId: string;
  pendingUsers: AuthUser[];
  pendingTotal: number;
  users: AuthUser[];
  total: number;
  page: number;
  limit: number;
}) {
  const router = useRouter();

  const approve = useMutation({
    mutationFn: (userId: string) => api.approveUser(factoryId, userId),
    onSuccess: () => router.refresh(),
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
                <TH />
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
                  <TD>
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(u.user_id)}
                      disabled={approve.isPending}
                    >
                      Approve
                    </Button>
                  </TD>
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
            <Table className="mt-4 border-0">
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
            </Table>
            <TablePagination total={total} page={page} limit={limit} />
          </>
        )}
      </Card>
    </div>
  );
}
