'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import type {
  CreateConfigurationInput,
  Machine,
  MachineConfiguration,
  MachineConfigProfile,
} from '@/lib/types';
import { formatDate } from '@/lib/utils';

function ApplyProfileSection({
  factoryId,
  machine,
  profiles,
}: {
  factoryId: string;
  machine: Machine;
  profiles: MachineConfigProfile[];
}) {
  const router = useRouter();
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.profile_id ?? '');

  const applyMutation = useMutation({
    mutationFn: () => api.applyConfigProfile(factoryId, selectedProfileId),
    onSuccess: () => router.refresh(),
  });

  if (profiles.length === 0) return null;

  const selected = profiles.find((p) => p.profile_id === selectedProfileId);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-blue-50 px-4 py-3">
      <Field label="Select Profile">
        <Select
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="min-w-[200px]"
        >
          {profiles.map((p) => (
            <option key={p.profile_id} value={p.profile_id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      {selected && (
        <p className="pb-1 text-xs text-muted">
          {selected.parameters.length} parameter{selected.parameters.length !== 1 ? 's' : ''}
        </p>
      )}

      <div className="pb-1">
        <Button
          size="sm"
          onClick={() => applyMutation.mutate()}
          disabled={applyMutation.isPending || !selectedProfileId}
        >
          {applyMutation.isPending ? 'Applying…' : 'Apply Profile'}
        </Button>
      </div>

      {applyMutation.isSuccess && (
        <p className="pb-1 text-xs text-green-700">Profile applied.</p>
      )}
      {applyMutation.isError && (
        <p className="pb-1 text-xs text-red-600">{applyMutation.error?.message}</p>
      )}
    </div>
  );
}

export function LineMachineConfig({
  factoryId,
  machines,
  configurations,
  profiles = [],
}: {
  factoryId: string;
  machines: Machine[];
  configurations: MachineConfiguration[];
  profiles?: MachineConfigProfile[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateConfigurationInput>({
    machine_id: machines[0]?.machine_id ?? '',
    key: '',
    value: '',
    unit: '',
    description: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.createConfiguration(factoryId, {
        machine_id: form.machine_id,
        key: form.key,
        value: form.value,
        unit: form.unit,
        description: form.description,
      }),
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      setForm((f) => ({ ...f, key: '', value: '', unit: '', description: '' }));
    },
  });

  const canSave = Boolean(form.key && form.value !== '' && form.machine_id);

  const configsByMachine = configurations.reduce<Record<string, MachineConfiguration[]>>(
    (acc, c) => {
      if (!c.machine_id) return acc;
      (acc[c.machine_id] ??= []).push(c);
      return acc;
    },
    {},
  );

  const profilesByMachine = profiles.reduce<Record<string, MachineConfigProfile[]>>(
    (acc, p) => {
      (acc[p.machine_id] ??= []).push(p);
      return acc;
    },
    {},
  );

  return (
    <Card>
      <CardHeader
        title="Machine Configurations"
        description="Operator-entered settings for each machine on this line"
        action={
          !open ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              + Add Config
            </Button>
          ) : undefined
        }
      />

      {open && (
        <div className="mb-6 rounded-lg border bg-slate-50 p-4">
          <h4 className="mb-4 text-sm font-semibold">Add Configuration</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Machine">
              <Select
                value={form.machine_id}
                onChange={(e) => setForm((f) => ({ ...f, machine_id: e.target.value }))}
              >
                {machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Parameter">
              <Input
                placeholder="e.g. speed_rpm, feed_rate"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              />
            </Field>

            <Field label="Value">
              <Input
                value={String(form.value)}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  setForm((f) => ({
                    ...f,
                    value:
                      Number.isFinite(num) && e.target.value !== '' ? num : e.target.value,
                  }));
                }}
              />
            </Field>

            <Field label="Unit">
              <Input
                placeholder="e.g. rpm, mm/s, bar"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea
                  rows={2}
                  placeholder="Optional notes for this setting"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSave}
            >
              {mutation.isPending ? 'Saving…' : 'Save Configuration'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {mutation.isError && (
              <p className="text-sm text-red-600">{mutation.error.message}</p>
            )}
          </div>
        </div>
      )}

      {machines.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No machines on this line.</p>
      ) : (
        <div className="space-y-6">
          {machines.map((machine) => {
            const configs = configsByMachine[machine.machine_id] ?? [];
            const machineProfiles = profilesByMachine[machine.machine_id] ?? [];

            return (
              <div key={machine.machine_id}>
                <h4 className="mb-3 text-sm font-semibold">{machine.name}</h4>

                <ApplyProfileSection
                  factoryId={factoryId}
                  machine={machine}
                  profiles={machineProfiles}
                />

                {configs.length === 0 ? (
                  <p className="text-xs text-muted">No configuration recorded for this machine.</p>
                ) : (
                  <Table className="border-0">
                    <THead>
                      <TR>
                        <TH>Parameter</TH>
                        <TH>Value</TH>
                        <TH>Unit</TH>
                        <TH>Source</TH>
                        <TH>Description</TH>
                        <TH>Last Updated</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {configs.map((c) => (
                        <TR key={c.config_id}>
                          <TD className="font-mono text-xs">{c.key}</TD>
                          <TD className="font-semibold">{String(c.value)}</TD>
                          <TD>{c.unit || '—'}</TD>
                          <TD>
                            {c.source === 'profile' && c.profile_name ? (
                              <Badge className="bg-blue-50 text-blue-700 text-xs">
                                {c.profile_name}
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 text-xs">
                                {c.source}
                              </Badge>
                            )}
                          </TD>
                          <TD className="text-muted">{c.description || '—'}</TD>
                          <TD>{formatDate(c.updated_at)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
