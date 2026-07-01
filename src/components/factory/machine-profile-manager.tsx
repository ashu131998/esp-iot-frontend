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
import { formatDate } from '@/lib/utils';
import type {
  ConfigProfileParameter,
  CreateConfigProfileInput,
  Machine,
  MachineConfigProfile,
} from '@/lib/types';

type FormState = CreateConfigProfileInput;

const emptyParam = (): ConfigProfileParameter => ({ key: '', value: '', unit: '', description: '' });

function ProfileForm({
  machines,
  initial,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  machines: Machine[];
  initial?: Partial<FormState>;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
  error?: string;
}) {
  const [form, setForm] = useState<FormState>({
    machine_id: initial?.machine_id ?? machines[0]?.machine_id ?? '',
    name: initial?.name ?? '',
    parameters: initial?.parameters?.length ? initial.parameters : [emptyParam()],
  });

  function updateParam(idx: number, field: keyof ConfigProfileParameter, val: string) {
    setForm((f) => {
      const params = [...f.parameters];
      params[idx] = { ...params[idx], [field]: val };
      return { ...f, parameters: params };
    });
  }

  function addParam() {
    setForm((f) => ({ ...f, parameters: [...f.parameters, emptyParam()] }));
  }

  function removeParam(idx: number) {
    setForm((f) => ({ ...f, parameters: f.parameters.filter((_, i) => i !== idx) }));
  }

  const canSave =
    Boolean(form.machine_id) &&
    Boolean(form.name.trim()) &&
    form.parameters.length > 0 &&
    form.parameters.every((p) => p.key.trim() && p.value !== '');

  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-semibold">
        {initial?.name ? 'Edit Profile' : 'New Configuration Profile'}
      </h4>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
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
        <Field label="Profile Name">
          <Input
            placeholder="e.g. Product A — High Speed"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
      </div>

      <p className="mb-2 text-xs font-medium text-muted">Parameters</p>
      <div className="mb-3 space-y-2">
        {form.parameters.map((param, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto_2fr_auto] gap-2 items-end">
            <Field label={idx === 0 ? 'Key' : undefined}>
              <Input
                placeholder="e.g. spindle_rpm"
                value={param.key}
                onChange={(e) => updateParam(idx, 'key', e.target.value)}
              />
            </Field>
            <Field label={idx === 0 ? 'Value' : undefined}>
              <Input
                placeholder="e.g. 1200"
                value={String(param.value)}
                onChange={(e) => updateParam(idx, 'value', e.target.value)}
              />
            </Field>
            <Field label={idx === 0 ? 'Unit' : undefined}>
              <Input
                placeholder="rpm"
                className="w-20"
                value={param.unit ?? ''}
                onChange={(e) => updateParam(idx, 'unit', e.target.value)}
              />
            </Field>
            <Field label={idx === 0 ? 'Description' : undefined}>
              <Input
                placeholder="optional"
                value={param.description ?? ''}
                onChange={(e) => updateParam(idx, 'description', e.target.value)}
              />
            </Field>
            <div className={idx === 0 ? 'pt-5' : ''}>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500"
                onClick={() => removeParam(idx)}
                disabled={form.parameters.length === 1}
              >
                ✕
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={addParam} className="mb-4">
        + Add Parameter
      </Button>

      <div className="flex items-center gap-2">
        <Button onClick={() => onSave(form)} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save Profile'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

export function MachineProfileManager({
  factoryId,
  machines,
  profiles,
  lastAppliedAt = {},
}: {
  factoryId: string;
  machines: Machine[];
  profiles: MachineConfigProfile[];
  lastAppliedAt?: Record<string, string>;
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (form: FormState) => api.createConfigProfile(factoryId, form),
    onSuccess: () => {
      router.refresh();
      setShowNew(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ profileId, form }: { profileId: string; form: FormState }) =>
      api.updateConfigProfile(factoryId, profileId, form),
    onSuccess: () => {
      router.refresh();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (profileId: string) => api.deleteConfigProfile(factoryId, profileId),
    onSuccess: () => router.refresh(),
  });

  const machineById = Object.fromEntries(machines.map((m) => [m.machine_id, m]));

  return (
    <Card>
      <CardHeader
        title="Machine Profiles"
        description="Manager-defined configuration presets. Operators select a profile when starting a shift."
        action={
          !showNew ? (
            <Button size="sm" onClick={() => setShowNew(true)}>
              + New Profile
            </Button>
          ) : undefined
        }
      />

      {showNew && (
        <div className="mb-6">
          <ProfileForm
            machines={machines}
            onSave={(form) => createMutation.mutate(form)}
            onCancel={() => setShowNew(false)}
            isSaving={createMutation.isPending}
            error={createMutation.isError ? createMutation.error?.message : undefined}
          />
        </div>
      )}

      {profiles.length === 0 && !showNew ? (
        <p className="py-8 text-center text-sm text-muted">
          No profiles yet. Add named presets so operators can pick a configuration at shift start.
        </p>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) =>
            editingId === profile.profile_id ? (
              <div key={profile.profile_id}>
                <ProfileForm
                  machines={machines}
                  initial={profile}
                  onSave={(form) =>
                    updateMutation.mutate({ profileId: profile.profile_id, form })
                  }
                  onCancel={() => setEditingId(null)}
                  isSaving={updateMutation.isPending}
                  error={updateMutation.isError ? updateMutation.error?.message : undefined}
                />
              </div>
            ) : (
              <div key={profile.profile_id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{profile.name}</span>
                    <Badge className="bg-slate-100 text-slate-600 text-xs">
                      {machineById[profile.machine_id]?.name ?? profile.machine_id}
                    </Badge>
                    <Badge className="bg-blue-50 text-blue-700 text-xs">
                      {profile.parameters.length} param{profile.parameters.length !== 1 ? 's' : ''}
                    </Badge>
                    {lastAppliedAt[profile.profile_id] ? (
                      <span className="text-xs text-muted">
                        Last run: {formatDate(lastAppliedAt[profile.profile_id])}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Never applied</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(profile.profile_id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => deleteMutation.mutate(profile.profile_id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {profile.parameters.length > 0 && (
                  <Table className="border-0">
                    <THead>
                      <TR>
                        <TH>Parameter</TH>
                        <TH>Value</TH>
                        <TH>Unit</TH>
                        <TH>Description</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {profile.parameters.map((p, i) => (
                        <TR key={i}>
                          <TD className="font-mono text-xs">{p.key}</TD>
                          <TD className="font-semibold">{String(p.value)}</TD>
                          <TD>{p.unit || '—'}</TD>
                          <TD className="text-muted">{p.description || '—'}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </Card>
  );
}
