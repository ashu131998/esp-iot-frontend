'use client';

import { Suspense } from 'react';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Card, CardHeader } from '@/components/ui/card';
import { LoadMore, ScrollTable } from '@/components/ui/load-more';
import { TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { FactoryAdminCreateForm } from '@/components/internal/factory-admin-create-form';
import { StaffCreateForm } from '@/components/internal/staff-create-form';
import { UserAdminActions } from '@/components/internal/user-admin-actions';
import { isInternalAdmin, isPlatformOwner } from '@/lib/internal-auth';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { resolveListTotal } from '@/lib/pagination';
import { queryShowsTableLoading } from '@/lib/query-table-loading';
import { useInfiniteList } from '@/lib/use-infinite-list';

function UsersPanelInner() {
  const { user } = useAuth();
  // Infinite scroll: the first users, then more as the list's end comes into view.
  const { items: users, total: usersTotal, hasMore, more, loading, query: usersQuery } = useInfiniteList({
    queryKey: ['admin-users'],
    fetchPage: ({ limit, offset, signal }) =>
      api.adminUsers({ limit, offset }, { signal }).then((r) => ({
        items: r.users ?? [],
        total: resolveListTotal(r.total, r.users?.length ?? 0, limit, offset),
      })),
  });

  async function fetchAllAdminUsers() {
    const allUsers = await fetchAllPages(({ limit, offset }) =>
      api.adminUsers({ limit, offset }).then((r) => ({
        items: r.users,
        total: r.total,
      })),
    );
    return allUsers.map((u) => [u.username, u.role, u.factory_id, u.status]);
  }

  const usersLoading = queryShowsTableLoading(usersQuery);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {isPlatformOwner(user) && (
        <Card className="p-6">
          <CardHeader title="Staff accounts" description="Platform owner creates internal_admin and internal_viewer logins" />
          <StaffCreateForm />
        </Card>
      )}

      {isInternalAdmin(user) && (
        <Card className="p-6">
          <CardHeader
            title="Factory admins"
            description="Add dashboard admins for a factory — a factory can have more than one"
          />
          <FactoryAdminCreateForm />
        </Card>
      )}

      <Card className="p-6">
        <CardHeader
          title="All users"
          action={
            <ExportCsvButton
              filename="all-users"
              headers={['Username', 'Role', 'Factory', 'Status']}
              fetchRows={fetchAllAdminUsers}
              rowCount={usersTotal}
            />
          }
        />
        {usersLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : users.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No users found.</p>
        ) : (
          <>
            <ScrollTable className="mt-4 border-0" rowCount={users.length}>
              <THead>
                <TR>
                  <TH>Username</TH>
                  <TH>Role</TH>
                  <TH>Factory</TH>
                  <TH>Status</TH>
                  <TH>Admin</TH>
                </TR>
              </THead>
              <TBody>
                {/* In the server's order: grouping staff first would slot a later page's staff in above rows already shown. */}
                {users.map((u) => (
                  <TR key={u.user_id}>
                    <TD>{u.username}</TD>
                    <TD>{u.role}</TD>
                    <TD>{u.factory_id ?? '—'}</TD>
                    <TD>{u.status}</TD>
                    <TD>
                      <UserAdminActions target={u} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </ScrollTable>
            <LoadMore shown={users.length} total={usersTotal} hasMore={hasMore} onMore={more} loading={loading} />
          </>
        )}
      </Card>
    </div>
  );
}

export function UsersPanel() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={5} />}>
      <UsersPanelInner />
    </Suspense>
  );
}
