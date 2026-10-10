'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export function OnboardPanel() {
  const qc = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState({
    factory_id: '',
    name: '',
    location: '',
    admin_username: '',
    admin_password: '',
  });
  const [message, setMessage] = useState('');

  const onboard = useMutation({
    mutationFn: () => api.onboardFactory(form),
    onSuccess: () => {
      setMessage('Factory onboarded successfully.');
      qc.invalidateQueries({ queryKey: ['admin-factories'] });
      router.refresh();
      setForm({ factory_id: '', name: '', location: '', admin_username: '', admin_password: '' });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <Card className="p-6">
      <CardHeader title="Onboard new factory" description="Create a factory and its admin account" />
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
  );
}
