'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/sheet';
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
      <Field label="Saved setting">
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
          {selected.parameters.length} setting{selected.parameters.length !== 1 ? 's' : ''}
        </p>
      )}

      <div className="pb-1">
        <Button
          size="sm"
          onClick={() => applyMutation.mutate()}
          disabled={applyMutation.isPending || !selectedProfileId}
        >
          {applyMutation.isPending ? 'Saving…' : 'Use this'}
        </Button>
      </div>

      {applyMutation.isSuccess && (
        <p className="pb-1 text-xs text-green-700">Setting in use.</p>
      )}
      {applyMutation.isError && (
        <p className="pb-1 text-xs text-red-600">{applyMutation.error?.message}</p>
      )}
    </div>
  );
}

export function MachineConfigCard({
  factoryId,
  machine,
  configurations,
  profiles = [],
}: {
  factoryId: string;
  machine: Machine;
  configurations: MachineConfiguration[];
  profiles?: MachineConfigProfile[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateConfigurationInput>({
    machine_id: machine.machine_id,
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
  const lastConfig = configurations.length > 0 ? configurations[0] : null;

  return (
    <Card>
      <CardHeader
        title="Machine settings"
        description="Settings now and before"
        action={
          !open ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              + Add a setting
            </Button>
          ) : undefined
        }
      />

      {open && (
        <Sheet title="Add a setting" onClose={() => setOpen(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Setting name">
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

            <div></div>

            <div className="sm:col-span-2">
              <Field label="Note">
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
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {mutation.isError && (
              <p className="text-sm text-red-600">{mutation.error.message}</p>
            )}
          </div>
        </Sheet>
      )}

      {lastConfig && (
        <div className="mb-6 rounded-lg border bg-green-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-green-800">Newest setting</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-green-700">Setting</p>
              <p className="font-mono font-semibold">{lastConfig.key}</p>
            </div>
            <div>
              <p className="text-xs text-green-700">Value</p>
              <p className="font-semibold">
                {String(lastConfig.value)} {lastConfig.unit && `${lastConfig.unit}`}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-green-700">Changed</p>
              <p className="text-xs">{formatDate(lastConfig.updated_at)}</p>
            </div>
            {lastConfig.description && (
              <div className="col-span-2">
                <p className="text-xs text-green-700">Note</p>
                <p className="text-xs">{lastConfig.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ApplyProfileSection factoryId={factoryId} machine={machine} profiles={profiles} />

      {configurations.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No settings saved for this machine yet.</p>
      ) : (
        <div>
          <h4 className="mb-3 text-sm font-semibold">Configuration History</h4>
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Setting</TH>
                <TH>Value</TH>
                <TH>Unit</TH>
                <TH>From</TH>
                <TH>Note</TH>
                <TH>Changed</TH>
              </TR>
            </THead>
            <TBody>
              {configurations.map((c) => (
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
        </div>
      )}
    </Card>
  );
}
