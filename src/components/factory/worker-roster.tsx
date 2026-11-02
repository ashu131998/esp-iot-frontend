'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import type { CreateWorkerInput, Worker } from '@/lib/types';

const ROLE_OPTIONS = [
  'Machine Operator',
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
  readOnly = false,
}: {
  factoryId: string;
  workers: Worker[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { t, tn } = useT();
  const [open, setOpen] = useState(false);
  const emptyForm: CreateWorkerInput = {
    name: '',
    employee_code: '',
    role: ROLE_OPTIONS[0],
    phone: '',
    email: '',
    password: '',
  };
  const [form, setForm] = useState<CreateWorkerInput>(emptyForm);

  const createMutation = useMutation({
    mutationFn: () => api.createWorker(factoryId, form),
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      setForm(emptyForm);
    },
  });

  // Email + password are required: they become the worker's login for the
  // AlertOps mobile app, where they receive their machine & shift alerts.
  const passwordValid = (form.password ?? '').length >= 8;
  const canSubmit = Boolean(form.name && form.email && passwordValid);

  const deleteMutation = useMutation({
    mutationFn: (workerId: string) => api.deleteWorker(factoryId, workerId),
    onSuccess: () => router.refresh(),
  });

  const columns = useMemo<ColumnDef<Worker, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: t('Name'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'employee_code',
      header: t('Code'),
      meta: { phoneHidden: true },
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.employee_code ?? '—'}</span>,
    },
    { accessorKey: 'role', header: t('Role'), cell: ({ row }) => t(row.original.role) },
    {
      id: 'skills',
      header: t('Skills'),
      enableSorting: false,
      meta: { phoneHidden: true },
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
      header: t('Phone'),
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted">{row.original.phone ?? '—'}</span>,
    },
    {
      accessorKey: 'email',
      header: t('App Login'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted">
          {row.original.email ?? '—'}
          {row.original.alertops_user_id && (
            <Badge className="ml-1 bg-emerald-50 text-emerald-700">{t('app')}</Badge>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => (
        <Badge className={row.original.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {t(row.original.status)}
        </Badge>
      ),
    },
    ...(readOnly
      ? []
      : [
          {
            id: 'actions',
            header: '',
            enableSorting: false,
            cell: ({ row }: { row: { original: Worker } }) => (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => deleteMutation.mutate(row.original.worker_id)}
              >
                {t('Delete')}
              </Button>
            ),
          } satisfies ColumnDef<Worker, unknown>,
        ]),
  ], [deleteMutation, readOnly, t]);

  return (
    <Card>
      <CardHeader
        title={t('Workers')}
        description={tn(workers.length, '{count} worker on the roster', '{count} workers on the roster')}
        action={
          !readOnly && !open ? (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              + {t('Add Worker')}
            </Button>
          ) : undefined
        }
      />

      {open && (
        <Sheet title={t('Add Worker')} onClose={() => setOpen(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Name')}>
              <Input
                placeholder={t('Full name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={t('Employee Code')}>
              <Input
                placeholder={t('e.g. EMP-1234')}
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              />
            </Field>
            <Field label={t('Role')}>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(r)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('Phone')}>
              <Input
                placeholder={t('+91 …')}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label={t('App Login Email')}>
              <Input
                type="email"
                placeholder="worker@factory.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={t('App Login Password')}>
              <Input
                type="password"
                placeholder={t('min 8 characters')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t("Email & password create the worker's login for the AlertOps mobile app, where they receive their machine and shift alerts.")}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !canSubmit}
            >
              {createMutation.isPending ? t('Saving…') : t('Add Worker')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            {createMutation.isError && (
              <p className="self-center text-sm text-red-600">{createMutation.error.message}</p>
            )}
          </div>
        </Sheet>
      )}

      <DataTable
        columns={columns}
        data={workers}
        className="border-0"
        emptyMessage={t('No workers yet. Add one using the button above.')}
      />
    </Card>
  );
}
