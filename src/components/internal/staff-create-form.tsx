'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';

export function StaffCreateForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    role: 'internal_viewer' as 'internal_admin' | 'internal_viewer',
  });
  const [message, setMessage] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createStaff({
        username: form.username,
        password: form.password,
        email: form.email || undefined,
        role: form.role,
      }),
    onSuccess: () => {
      setMessage('Staff account created.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setForm({ username: '', password: '', email: '', role: 'internal_viewer' });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <form
      className="mt-4 grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <Field label="Username">
        <Input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          minLength={3}
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
      <Field label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="Role">
        <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
          <option value="internal_viewer">internal_viewer (read-only)</option>
          <option value="internal_admin">internal_admin (internal write)</option>
        </Select>
      </Field>
      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create staff account'}
        </Button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </div>
    </form>
  );
}
