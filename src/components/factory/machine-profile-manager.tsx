'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { MachineMultiSelect } from '@/components/factory/machine-multi-select';
import { Field, Input } from '@/components/ui/input';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type {
  ConfigProfileParameter,
  Machine,
  MachineConfigProfile,
  ProductionLine,
} from '@/lib/types';

type FormState = {
  machine_ids: string[];
  name: string;
  parameters: ConfigProfileParameter[];
};

const emptyParam = (): ConfigProfileParameter => ({ key: '', value: '', unit: '', description: '' });

function ProfileForm({
  machines,
  lines,
  initial,
  editingProfileId,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  machines: Machine[];
  lines?: ProductionLine[];
  initial?: Partial<FormState> & { machine_id?: string };
  editingProfileId?: string;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  isSaving: boolean;
  error?: string;
}) {
  const lockedMachineId = initial?.machine_id;

  const initialMachineIds =
    initial?.machine_ids?.length
      ? initial.machine_ids
      : lockedMachineId
        ? [lockedMachineId]
        : machines[0]?.machine_id
          ? [machines[0].machine_id]
          : [];

  const [form, setForm] = useState<FormState>({
    machine_ids: initialMachineIds,
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
    form.machine_ids.length > 0 &&
    Boolean(form.name.trim()) &&
    form.parameters.length > 0 &&
    form.parameters.every((p) => p.key.trim() && p.value !== '');

  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-semibold">
        {initial?.name ? 'Edit Profile' : 'New Configuration Profile'}
      </h4>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="Profile Name">
          <Input
            placeholder="e.g. Product A — High Speed"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
      </div>

      <div className="mb-4">
        <Field
          label={
            editingProfileId
              ? 'Machines (add more to copy this profile)'
              : 'Machines'
          }
        >
          <MachineMultiSelect
            machines={machines}
            lines={lines}
            selectedIds={form.machine_ids}
            lockedIds={lockedMachineId ? [lockedMachineId] : []}
            onChange={(machine_ids) => setForm((f) => ({ ...f, machine_ids }))}
          />
        </Field>
        {lockedMachineId && (
          <p className="mt-1 text-xs text-muted">
            This profile stays on{' '}
            {machines.find((m) => m.machine_id === lockedMachineId)?.name ?? lockedMachineId}.
            Select additional machines to create matching profiles for them.
          </p>
        )}
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

async function saveProfilesForMachines(
  factoryId: string,
  form: FormState,
  opts?: { updateProfileId?: string },
) {
  const payload = {
    name: form.name.trim(),
    parameters: form.parameters,
    machine_ids: form.machine_ids,
  };

  if (opts?.updateProfileId) {
    await api.updateConfigProfile(factoryId, opts.updateProfileId, payload);
    return;
  }

  await api.createConfigProfile(factoryId, payload);
}

export function MachineProfileManager({
  factoryId,
  machines,
  lines,
  profiles,
  lastAppliedAt = {},
}: {
  factoryId: string;
  machines: Machine[];
  lines?: ProductionLine[];
  profiles: MachineConfigProfile[];
  lastAppliedAt?: Record<string, string>;
}) {
  const router = useRouter();
  const { canWriteFactory } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (form: FormState) => saveProfilesForMachines(factoryId, form),
    onSuccess: () => {
      router.refresh();
      setShowNew(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ profileId, form }: { profileId: string; form: FormState }) =>
      saveProfilesForMachines(factoryId, form, { updateProfileId: profileId }),
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
          canWriteFactory && !showNew ? (
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
            lines={lines}
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
                  lines={lines}
                  initial={profile}
                  editingProfileId={profile.profile_id}
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
                  {canWriteFactory && (
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
                  )}
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
