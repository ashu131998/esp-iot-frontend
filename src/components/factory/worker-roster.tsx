'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { api } from '@/lib/api';
import type { CreateWorkerInput, Worker } from '@/lib/types';

const ROLE_OPTIONS = [
  'Loom Operator',
  'Weaver',
  'Maintenance Technician',
  'Quality Inspector',
  'Shift Supervisor',
  'Material Handler',
  'Electrician',
];

export function WorkerRoster({
  factoryId,
  workers,
}: {
  factoryId: string;
  workers: Worker[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateWorkerInput>({
    name: '',
    employee_code: '',
    role: ROLE_OPTIONS[0],
    phone: '',
  });

  const createMutation = useMutation({
    mutationFn: () => api.createWorker(factoryId, form),
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      setForm({ name: '', employee_code: '', role: ROLE_OPTIONS[0], phone: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (workerId: string) => api.deleteWorker(factoryId, workerId),
    onSuccess: () => router.refresh(),
  });

  const columns = useMemo<ColumnDef<Worker, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'employee_code',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.employee_code ?? '—'}</span>,
    },
    { accessorKey: 'role', header: 'Role' },
    {
      id: 'skills',
      header: 'Skills',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex max-w-xs flex-wrap gap-1">
          {(row.original.skills ?? []).map((s) => (
            <Badge key={s} className="bg-slate-100 text-slate-700">{s}</Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted">{row.original.phone ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={row.original.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          onClick={() => deleteMutation.mutate(row.original.worker_id)}
        >
          Delete
        </Button>
      ),
    },
  ], [deleteMutation]);

  return (
    <Card>
      <CardHeader
        title="Workers"
        description={`${workers.length} worker${workers.length === 1 ? '' : 's'} on the roster`}
        action={
          !open ? (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              + Add Worker
            </Button>
          ) : undefined
        }
      />

      {open && (
        <div className="mb-4 rounded-lg border bg-slate-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name">
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Employee Code">
              <Input
                placeholder="e.g. EMP-1234"
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Phone">
              <Input
                placeholder="+91 …"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name}
            >
              {createMutation.isPending ? 'Saving…' : 'Add Worker'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {createMutation.isError && (
              <p className="self-center text-sm text-red-600">{createMutation.error.message}</p>
            )}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={workers}
        className="border-0"
        emptyMessage="No workers yet. Add one using the button above."
      />
    </Card>
  );
}
