'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/input';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { filterMachinesByScope, useFactoryDateRange } from '@/lib/use-factory-date-range';
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
  lockMachine,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  machines: Machine[];
  initial?: Partial<FormState>;
  /** When editing, profile stays on this machine. */
  lockMachine?: boolean;
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
            disabled={lockMachine}
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
  const { canWriteFactory } = useAuth();
  const { machineId, lineId } = useFactoryDateRange();
  const [newProfileMachineId, setNewProfileMachineId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profilePendingDelete, setProfilePendingDelete] = useState<MachineConfigProfile | null>(
    null,
  );

  const createMutation = useMutation({
    mutationFn: (form: FormState) => api.createConfigProfile(factoryId, form),
    onSuccess: () => {
      router.refresh();
      setNewProfileMachineId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ profileId, form }: { profileId: string; form: FormState }) =>
      api.updateConfigProfile(factoryId, profileId, {
        name: form.name,
        parameters: form.parameters,
      }),
    onSuccess: () => {
      router.refresh();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (profileId: string) => api.deleteConfigProfile(factoryId, profileId),
    onSuccess: () => {
      setProfilePendingDelete(null);
      router.refresh();
    },
  });

  const machineById = Object.fromEntries(machines.map((m) => [m.machine_id, m]));

  const profilesByMachine = useMemo(() => {
    const map = new Map<string, MachineConfigProfile[]>();
    for (const m of machines) map.set(m.machine_id, []);
    for (const p of profiles) {
      if (!map.has(p.machine_id)) map.set(p.machine_id, []);
      map.get(p.machine_id)!.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [machines, profiles]);

  const machinesSorted = useMemo(
    () => filterMachinesByScope(machines, { machineId, lineId }),
    [machines, machineId, lineId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Machine Profiles</h2>
        <p className="mt-1 text-sm text-muted">
          Configuration presets per machine. Operators select a profile when starting a shift.
        </p>
      </div>

      {machines.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-muted">No machines registered for this factory.</p>
        </Card>
      ) : machinesSorted.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-muted">
            No machines match the current line or machine filter.
          </p>
        </Card>
      ) : (
        machinesSorted.map((machine) => {
          const machineProfiles = profilesByMachine.get(machine.machine_id) ?? [];
          const isAddingHere = newProfileMachineId === machine.machine_id;
          const editingHere = machineProfiles.some((p) => p.profile_id === editingId);

          const profileCountLabel =
            machineProfiles.length === 0
              ? 'No profiles yet'
              : `${machineProfiles.length} profile${machineProfiles.length !== 1 ? 's' : ''}`;

          return (
            <Card key={machine.machine_id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {machine.name}
                    <Badge className="bg-slate-100 font-normal text-slate-700">{profileCountLabel}</Badge>
                  </span>
                }
                description={`${machine.line_id} · ${machine.type}`}
                action={
                  canWriteFactory && !isAddingHere && !editingHere ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setNewProfileMachineId(machine.machine_id);
                      }}
                    >
                      + Profile
                    </Button>
                  ) : undefined
                }
              />

              {isAddingHere && (
                <div className="mb-4">
                  <ProfileForm
                    machines={machines}
                    initial={{ machine_id: machine.machine_id }}
                    lockMachine
                    onSave={(form) => createMutation.mutate(form)}
                    onCancel={() => setNewProfileMachineId(null)}
                    isSaving={createMutation.isPending}
                    error={createMutation.isError ? createMutation.error?.message : undefined}
                  />
                </div>
              )}

              {machineProfiles.length === 0 && !isAddingHere ? (
                <p className="text-sm text-muted">No profiles for this machine yet.</p>
              ) : (
                <div className="space-y-4">
                  {machineProfiles.map((profile, profileIndex) =>
                    editingId === profile.profile_id ? (
                      <div
                        key={profile.profile_id}
                        className={profileIndex > 0 ? 'border-t border-dashed pt-4' : undefined}
                      >
                        <ProfileForm
                          machines={machines}
                          initial={profile}
                          lockMachine
                          onSave={(form) =>
                            updateMutation.mutate({ profileId: profile.profile_id, form })
                          }
                          onCancel={() => setEditingId(null)}
                          isSaving={updateMutation.isPending}
                          error={
                            updateMutation.isError ? updateMutation.error?.message : undefined
                          }
                        />
                      </div>
                    ) : (
                      <div
                        key={profile.profile_id}
                        className={
                          profileIndex > 0
                            ? 'mt-4 rounded-lg border border-dashed bg-slate-50/50 p-4'
                            : 'rounded-lg border bg-slate-50/50 p-4'
                        }
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {machineProfiles.length > 1 && (
                              <span className="text-xs font-medium text-muted">
                                Profile {profileIndex + 1} of {machineProfiles.length}
                              </span>
                            )}
                            <span className="font-semibold text-sm">{profile.name}</span>
                            <Badge className="bg-blue-50 text-blue-700 text-xs">
                              {profile.parameters.length} param
                              {profile.parameters.length !== 1 ? 's' : ''}
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
                                onClick={() => {
                                  setNewProfileMachineId(null);
                                  setEditingId(profile.profile_id);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => setProfilePendingDelete(profile)}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>

                        {profile.parameters.length > 0 && (
                          <Table className="border-0 bg-transparent">
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
        })
      )}

      <Modal
        open={profilePendingDelete !== null}
        title="Delete profile?"
        description={
          profilePendingDelete
            ? `Remove "${profilePendingDelete.name}" for ${
                machineById[profilePendingDelete.machine_id]?.name ??
                profilePendingDelete.machine_id
              }? Operators will no longer see this preset. Applied configuration values on the machine are not removed.`
            : undefined
        }
        onClose={() => {
          if (!deleteMutation.isPending) setProfilePendingDelete(null);
        }}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={deleteMutation.isPending}
            onClick={() => setProfilePendingDelete(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={deleteMutation.isPending || !profilePendingDelete}
            onClick={() => {
              if (profilePendingDelete) deleteMutation.mutate(profilePendingDelete.profile_id);
            }}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete profile'}
          </Button>
        </div>
        {deleteMutation.isError && (
          <p className="mt-3 text-sm text-red-600">{deleteMutation.error.message}</p>
        )}
      </Modal>
    </div>
  );
}
