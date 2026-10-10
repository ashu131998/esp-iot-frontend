'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Card, CardHeader } from '@/components/ui/card';
import { TablePagination } from '@/components/ui/table-pagination';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { StaffCreateForm } from '@/components/internal/staff-create-form';
import { UserAdminActions } from '@/components/internal/user-admin-actions';
import { isPlatformOwner } from '@/lib/internal-auth';
import { resolvePagination, resolveListTotal } from '@/lib/pagination';

function UsersPanelInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const pagination = resolvePagination({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users', pagination.page, pagination.limit],
    queryFn: ({ signal }) =>
      api.adminUsers({ limit: pagination.limit, offset: pagination.offset }, { signal }),
  });

  const usersTotal = resolveListTotal(
    usersQuery.data?.total,
    usersQuery.data?.users?.length ?? 0,
    pagination.limit,
    pagination.offset,
  );

  async function fetchAllAdminUsers() {
    const allUsers = await fetchAllPages(({ limit, offset }) =>
      api.adminUsers({ limit, offset }).then((r) => ({
        items: r.users,
        total: r.total,
      })),
    );
    return allUsers.map((u) => [u.username, u.role, u.factory_id, u.status]);
  }

  const staff = (usersQuery.data?.users ?? []).filter((u) => !u.factory_id);
  const factoryUsers = (usersQuery.data?.users ?? []).filter((u) => u.factory_id);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {isPlatformOwner(user) && (
        <Card className="p-6">
          <CardHeader title="Staff accounts" description="Platform owner creates internal_admin and internal_viewer logins" />
          <StaffCreateForm />
          {staff.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No staff accounts yet besides owner.</p>
          ) : (
            <Table className="mt-4 border-0">
              <THead>
                <TR>
                  <TH>Username</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Admin</TH>
                </TR>
              </THead>
              <TBody>
                {staff.map((u) => (
                  <TR key={u.user_id}>
                    <TD>{u.username}</TD>
                    <TD>{u.role}</TD>
                    <TD>{u.status}</TD>
                    <TD>
                      <UserAdminActions target={u} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
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
        {factoryUsers.length === 0 && staff.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No users found.</p>
        ) : (
          <>
            <Table className="mt-4 border-0">
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
                {[...staff, ...factoryUsers].map((u) => (
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
            </Table>
            <TablePagination total={usersTotal} page={pagination.page} limit={pagination.limit} />
          </>
        )}
      </Card>
    </div>
  );
}

export function UsersPanel() {
  return (
    <Suspense fallback={null}>
      <UsersPanelInner />
    </Suspense>
  );
}
