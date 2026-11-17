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
  // The app login of one worker on the roster: an account made now (email + password), or a new password.
  const [loginFor, setLoginFor] = useState<Worker | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const openLogin = (w: Worker) => {
    setLoginFor(w);
    setLoginForm({ email: w.email ?? '', password: '' });
  };
  const loginMutation = useMutation({
    mutationFn: (w: Worker) => api.updateWorker(factoryId, w.worker_id, w.user_id ? { password: loginForm.password } : { email: loginForm.email.trim(), password: loginForm.password }),
    onSuccess: () => {
      router.refresh();
      setLoginFor(null);
    },
  });
  const loginValid = loginForm.password.length >= 8 && (Boolean(loginFor?.user_id) || loginForm.email.trim().includes('@'));

  const createMutation = useMutation({
    mutationFn: () => api.createWorker(factoryId, form),
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      setForm(emptyForm);
    },
  });

  // Email + password are required: they become the worker's login for the
  // FloorBeat Alerts app, where they receive their machine & shift alerts.
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
          {(row.original.user_id || row.original.alertops_user_id) && (
            <span title={t('Has a login for the FloorBeat Alerts app')}>
              <Badge className="ml-1 bg-emerald-50 text-emerald-700">{t('app')}</Badge>
            </span>
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
              <span className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openLogin(row.original)}>
                  {row.original.user_id ? t('New password') : t('App login')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => deleteMutation.mutate(row.original.worker_id)}
                >
                  {t('Delete')}
                </Button>
              </span>
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
            {t("Email & password create the worker's login for the FloorBeat Alerts app (alerts.floorbeat.in), where they receive their machine and shift alerts.")}
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

      {loginFor && (
        <Sheet title={loginFor.user_id ? t('New password') : t('App login')} onClose={() => setLoginFor(null)}>
          <p className="text-sm text-muted">
            {loginFor.user_id
              ? t('Set a new password for {name}. Every phone signed in as them will have to sign in again.', { name: loginFor.name })
              : t('Give {name} a login for the FloorBeat Alerts app (alerts.floorbeat.in): their work email and a password.', { name: loginFor.name })}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {!loginFor.user_id && (
              <Field label={t('App Login Email')}>
                <Input
                  type="email"
                  placeholder="worker@factory.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </Field>
            )}
            <Field label={t('App Login Password')}>
              <Input
                type="password"
                placeholder={t('min 8 characters')}
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => loginMutation.mutate(loginFor)} disabled={loginMutation.isPending || !loginValid}>
              {loginMutation.isPending ? t('Saving…') : loginFor.user_id ? t('Set password') : t('Save login')}
            </Button>
            <Button variant="ghost" onClick={() => setLoginFor(null)}>{t('Cancel')}</Button>
            {loginMutation.isError && (
              <p className="self-center text-sm text-red-600">{loginMutation.error.message}</p>
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
