'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';

export function FactoryAdminCreateForm() {
  const qc = useQueryClient();
  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });
  const factories = factoriesQuery.data?.factories ?? [];

  const [form, setForm] = useState({
    factory_id: '',
    username: '',
    password: '',
    email: '',
  });
  const [message, setMessage] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createFactoryAdmin(form.factory_id, {
        username: form.username,
        password: form.password,
        email: form.email || undefined,
      }),
    onSuccess: (res) => {
      const w = res.welcome_email;
      setMessage(
        !w ? 'Factory admin created.'
          : w.sent ? `Factory admin created. Welcome email sent to ${w.email}.`
            : `Factory admin created, but the welcome email to ${w.email} did not go (${w.error ?? 'not sent'}). Send them their sign-in details yourself.`,
      );
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setForm((f) => ({ ...f, username: '', password: '', email: '' }));
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const canSubmit =
    form.factory_id && form.username.length >= 3 && form.password.length >= 8 && !create.isPending;

  return (
    <form
      className="mt-4 grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) create.mutate();
      }}
    >
      <Field label="Factory">
        <Select
          value={form.factory_id}
          required
          onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
          disabled={factoriesQuery.isLoading}
        >
          <option value="">Select factory…</option>
          {factories.map((f) => (
            <option key={f.factory_id} value={f.factory_id}>
              {f.name} ({f.factory_id})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Username">
        <Input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          minLength={3}
          placeholder="e.g. mill_admin_2"
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
      </Field>
      <Field label="Email (optional — they get a welcome email with their sign-in details)">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={!canSubmit}>
          {create.isPending ? 'Creating…' : 'Create factory admin'}
        </Button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </div>
    </form>
  );
}
