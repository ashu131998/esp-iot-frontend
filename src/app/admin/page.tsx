'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Field, Input } from '@/components/ui/input';
import { TablePagination } from '@/components/ui/table-pagination';
import { DataTable } from '@/components/ui/data-table';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { resolvePagination, resolveListTotal } from '@/lib/pagination';

// useSearchParams() requires a Suspense boundary to avoid the static-export
// CSR-bailout; the inner console reads ?page/?limit for the users table.
export default function AdminConsolePage() {
  return (
    <Suspense fallback={null}>
      <AdminConsole />
    </Suspense>
  );
}

function AdminConsole() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pagination = resolvePagination({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  const [form, setForm] = useState({
    factory_id: '',
    name: '',
    location: '',
    admin_username: '',
    admin_password: '',
  });
  const [message, setMessage] = useState('');

  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users', pagination.page, pagination.limit],
    queryFn: ({ signal }) =>
      api.adminUsers(
        {
          limit: pagination.limit,
          offset: pagination.offset,
        },
        { signal },
      ),
  });

  const onboard = useMutation({
    mutationFn: () => api.onboardFactory(form),
    onSuccess: () => {
      setMessage('Factory onboarded successfully.');
      qc.invalidateQueries({ queryKey: ['admin-factories'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      router.refresh();
      setForm({ factory_id: '', name: '', location: '', admin_username: '', admin_password: '' });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  type AdminFactoryRow = NonNullable<typeof factoriesQuery.data>['factories'][number];
  const factoryColumns = useMemo<ColumnDef<AdminFactoryRow, unknown>[]>(() => [
    { accessorKey: 'factory_id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'machine_count',
      header: 'Machines',
      cell: ({ row }) => row.original.machine_count ?? '—',
    },
  ], []);

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

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Super Admin Console</h1>
            <p className="text-sm text-muted">Signed in as {user?.username}</p>
          </div>
          <Button variant="secondary" onClick={() => logout().then(() => (window.location.href = '/admin/login'))}>
            Sign out
          </Button>
        </div>

        <Card className="p-6">
          <CardHeader title="Onboard New Factory" description="Create a factory and its admin account" />
          <form
            className="mt-4 grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onboard.mutate();
            }}
          >
            <Field label="Factory ID">
              <Input
                value={form.factory_id}
                onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
                placeholder="factory-delhi-03"
                required
              />
            </Field>
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Admin username">
              <Input
                value={form.admin_username}
                onChange={(e) => setForm({ ...form, admin_username: e.target.value })}
                required
              />
            </Field>
            <Field label="Admin password">
              <Input
                type="password"
                value={form.admin_password}
                onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                required
                minLength={8}
              />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" disabled={onboard.isPending}>
                {onboard.isPending ? 'Creating…' : 'Create factory + admin'}
              </Button>
              {message && <p className="mt-2 text-sm text-muted">{message}</p>}
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Factories"
            action={
              <ExportCsvButton
                filename="factories"
                headers={['ID', 'Name', 'Location', 'Machines']}
                rows={(factoriesQuery.data?.factories ?? []).map((f) => [
                  f.factory_id,
                  f.name,
                  f.location,
                  f.machine_count,
                ])}
              />
            }
          />
          <div className="mt-4">
            <DataTable
              columns={factoryColumns}
              data={factoriesQuery.data?.factories ?? []}
              emptyMessage="No factories found."
            />
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="All Users"
            action={
              <ExportCsvButton
                filename="all-users"
                headers={['Username', 'Role', 'Factory', 'Status']}
                fetchRows={fetchAllAdminUsers}
                rowCount={usersTotal}
              />
            }
          />
          {(usersQuery.data?.users ?? []).length === 0 ? (
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
                  </TR>
                </THead>
                <TBody>
                  {(usersQuery.data?.users ?? []).map((u) => (
                    <TR key={u.user_id}>
                      <TD>{u.username}</TD>
                      <TD>{u.role}</TD>
                      <TD>{u.factory_id ?? '—'}</TD>
                      <TD>{u.status}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <TablePagination
                total={usersTotal}
                page={pagination.page}
                limit={pagination.limit}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
