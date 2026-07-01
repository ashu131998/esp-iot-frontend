'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { CreateConfigurationInput, Machine, ProductionLine } from '@/lib/types';

type ConfigScope = 'machine' | 'line';

export function ConfigurationForm({
  factoryId,
  machines,
  lines,
}: {
  factoryId: string;
  machines: Machine[];
  lines: ProductionLine[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ConfigScope>('machine');
  const [form, setForm] = useState<CreateConfigurationInput>({
    machine_id: machines[0]?.machine_id ?? '',
    line_id: lines[0]?.line_id ?? '',
    key: '',
    value: '',
    unit: '',
    description: '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateConfigurationInput = {
        key: form.key,
        value: form.value,
        unit: form.unit,
        description: form.description,
      };

      if (scope === 'machine') {
        payload.machine_id = form.machine_id;
      } else {
        payload.line_id = form.line_id;
      }

      return api.createConfiguration(factoryId, payload);
    },
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      setForm({ ...form, key: '', value: '', unit: '', description: '' });
    },
  });

  const canSave =
    form.key &&
    form.value !== '' &&
    (scope === 'machine' ? Boolean(form.machine_id) : Boolean(form.line_id));

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Add Configuration
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-semibold">Add Configuration</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scope">
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value as ConfigScope)}
          >
            <option value="machine">Machine</option>
            <option value="line">Line</option>
          </Select>
        </Field>

        {scope === 'machine' ? (
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
        ) : (
          <Field label="Line">
            <Select
              value={form.line_id}
              onChange={(e) => setForm({ ...form, line_id: e.target.value })}
            >
              {lines.map((line) => (
                <option key={line.line_id} value={line.line_id}>
                  {line.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Parameter Key">
          <Input
            placeholder="e.g. spindle_speed_rpm"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
          />
        </Field>
        <Field label="Value">
          <Input
            value={String(form.value)}
            onChange={(e) => {
              const num = Number(e.target.value);
              setForm({
                ...form,
                value: Number.isFinite(num) && e.target.value !== '' ? num : e.target.value,
              });
            }}
          />
        </Field>
        <Field label="Unit">
          <Input
            placeholder="e.g. rpm, mm, lpm"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? 'Saving…' : 'Save Configuration'}
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
