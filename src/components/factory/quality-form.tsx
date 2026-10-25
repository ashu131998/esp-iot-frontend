'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { CreateQualityInput, Machine } from '@/lib/types';

export function QualityForm({
  factoryId,
  machines,
  onSuccess,
}: {
  factoryId: string;
  machines: Machine[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateQualityInput>({
    machine_id: machines[0]?.machine_id ?? '',
    metric: 'defect_rate',
    value: 0,
    unit: 'percent',
    sample_size: 100,
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const machine = machines.find((m) => m.machine_id === form.machine_id);
      return api.createQuality(factoryId, {
        ...form,
        line_id: machine?.line_id,
      });
    },
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      onSuccess?.();
    },
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Add Quality Record
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-semibold">Add Quality Record</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Machine">
          <Select
            value={form.machine_id}
            onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
          >
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Metric">
          <Select
            value={form.metric}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
          >
            <option value="defect_rate">Defect Rate</option>
            <option value="first_pass_yield">First Pass Yield</option>
            <option value="scrap_rate">Scrap Rate</option>
            <option value="rework_rate">Rework Rate</option>
          </Select>
        </Field>
        <Field label="Value">
          <Input
            type="number"
            step="0.1"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
          />
        </Field>
        <Field label="Unit">
          <Select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            <option value="percent">Percent</option>
            <option value="ppm">PPM</option>
            <option value="count">Count</option>
          </Select>
        </Field>
        <Field label="Sample Size">
          <Input
            type="number"
            value={form.sample_size ?? ''}
            onChange={(e) => setForm({ ...form, sample_size: Number(e.target.value) })}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save Record'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {mutation.isError && (
          <p className="self-center text-sm text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
