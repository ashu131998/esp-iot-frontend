'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

/**
 * The partner (machine dealer, electrician) who brought this factory in: they keep a share of its
 * subscription and get first call on its repair work. Staff only (English).
 */
export function ReferralCard({ factoryId, initial }: { factoryId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? '');
  const [saved, setSaved] = useState(initial ?? '');
  const save = useMutation({
    mutationFn: (referredBy: string | null) => api.adminSetFactoryReferral(factoryId, referredBy),
    onSuccess: (row) => {
      setSaved(row.referred_by ?? '');
      setValue(row.referred_by ?? '');
    },
  });
  const dirty = value.trim() !== saved;

  return (
    <Card>
      <CardHeader
        title="Referred by"
        description="The partner who brought this factory in: a share of the subscription and first call on repair work."
      />
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(value.trim() || null);
        }}
      >
        <Input
          value={value}
          maxLength={120}
          placeholder="Patel Engineering Works, Surat"
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      {save.error && <p className="mt-2 text-sm text-red-600">{(save.error as Error).message}</p>}
    </Card>
  );
}
