'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { AddNodeModal } from '@/components/internal/add-node-modal';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Machine } from '@/lib/types';
import { isInternalAdmin } from '@/lib/internal-auth';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { useAuth } from '@/lib/auth-context';
import { queryShowsTableLoading } from '@/lib/query-table-loading';

export function FactorySetupPanel({ factoryId }: { factoryId: string }) {
  const { user } = useAuth();
  const canWrite = isInternalAdmin(user);
  const qc = useQueryClient();

  const [lineModal, setLineModal] = useState(false);
  const [machineModal, setMachineModal] = useState(false);
  const [nodeModal, setNodeModal] = useState(false);

  const [lineForm, setLineForm] = useState({ line_id: '', name: '' });
  const emptyMachineForm = {
    machine_id: '',
    line_id: '',
    name: '',
    type: 'loom',
    rotations_per_unit: '1',
    unit_label: '',
  };
  const [machineForm, setMachineForm] = useState(emptyMachineForm);
  // Production unit being edited for an existing machine (null = dialog closed).
  const [unitEdit, setUnitEdit] = useState<{ machine: Machine; rotations_per_unit: string; unit_label: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const factoryQuery = useQuery({
    queryKey: ['factory-detail', factoryId],
    queryFn: ({ signal }) => api.factory(factoryId, { signal }),
  });

  const linesQuery = useQuery({
    queryKey: ['factory-lines', factoryId],
    queryFn: ({ signal }) => api.lines(factoryId, { limit: 200, offset: 0 }, { signal }),
  });

  const machinesQuery = useQuery({
    queryKey: ['factory-machines', factoryId],
    queryFn: ({ signal }) => api.machines(factoryId, undefined, { signal }),
  });

  const lines = linesQuery.data?.lines ?? [];
  const machines = machinesQuery.data?.machines ?? [];
  const factory = factoryQuery.data;

  const createLine = useMutation({
    mutationFn: () => api.adminCreateLine(factoryId, lineForm),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['factory-lines', factoryId] });
      await qc.invalidateQueries({ queryKey: ['admin-factories'] });
      setLineForm({ line_id: '', name: '' });
      setLineModal(false);
      setMessage(null);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const createMachine = useMutation({
    mutationFn: () =>
      api.adminCreateMachine(factoryId, {
        machine_id: machineForm.machine_id,
        line_id: machineForm.line_id,
        name: machineForm.name,
        type: machineForm.type,
        rotations_per_unit: Number(machineForm.rotations_per_unit) || 1,
        unit_label: machineForm.unit_label.trim() || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['factory-machines', factoryId] });
      await qc.invalidateQueries({ queryKey: ['admin-factories'] });
      setMachineForm(emptyMachineForm);
      setMachineModal(false);
      setMessage(null);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const updateUnits = useMutation({
    mutationFn: (edit: NonNullable<typeof unitEdit>) =>
      api.adminUpdateMachineUnits(factoryId, edit.machine.machine_id, {
        rotations_per_unit: Number(edit.rotations_per_unit),
        unit_label: edit.unit_label.trim() || null,
      }),
    onSuccess: async () => {
      // Every production figure of this factory changes with the unit: refetch what is on screen.
      await qc.invalidateQueries();
      setUnitEdit(null);
      setMessage(null);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title={factory?.name ?? factoryId}
          description={factory?.location ?? factoryId}
          action={
            canWrite && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setNodeModal(true)}>
                  Register node
                </Button>
                <Link
                  href={`/internal/nodes?factory_id=${encodeURIComponent(factoryId)}`}
                  className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  View all nodes
                </Link>
              </div>
            )
          }
        />
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Timezone</dt>
            <dd>{factory?.timezone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Lines</dt>
            <dd className="font-semibold">{lines.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Machines</dt>
            <dd className="font-semibold">{machines.length}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Production lines"
          description="Lines group machines on the shop floor. Every node and machine belongs to one line."
          action={
            canWrite && (
              <Button size="sm" onClick={() => setLineModal(true)}>
                Add line
              </Button>
            )
          }
        />
        {queryShowsTableLoading(linesQuery) ? (
          <TableSkeleton rows={4} cols={2} />
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted">No lines yet — add one before registering machines or nodes.</p>
        ) : (
          <Table className="mt-4 border-0">
            <THead>
              <TR>
                <TH>Line ID</TH>
                <TH>Name</TH>
              </TR>
            </THead>
            <TBody>
              {lines.map((l) => (
                <TR key={l.line_id}>
                  <TD className="font-mono text-sm">{l.line_id}</TD>
                  <TD>{l.name}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Machines"
          description="Onboard looms and other assets. Sensor bindings link ESP channels to these machines."
          action={
            canWrite && (
              <Button size="sm" onClick={() => setMachineModal(true)} disabled={lines.length === 0}>
                Add machine
              </Button>
            )
          }
        />
        {queryShowsTableLoading(machinesQuery) ? (
          <TableSkeleton rows={6} cols={4} />
        ) : machines.length === 0 ? (
          <p className="text-sm text-muted">No machines yet.</p>
        ) : (
          <Table className="mt-4 border-0">
            <THead>
              <TR>
                <TH>Machine</TH>
                <TH>Line</TH>
                <TH>Type</TH>
                <TH>Production unit</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {machines.map((m) => (
                <TR key={m.machine_id}>
                  <TD className="font-medium">{m.name}</TD>
                  <TD className="font-mono text-xs">{m.line_id}</TD>
                  <TD className="capitalize">{m.type}</TD>
                  <TD className="text-xs">{unitSummary(m)}</TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-3">
                      {canWrite && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setMessage(null);
                            setUnitEdit({
                              machine: m,
                              rotations_per_unit: String(m.rotations_per_unit ?? 1),
                              unit_label: m.unit_label ?? '',
                            });
                          }}
                        >
                          Edit unit
                        </button>
                      )}
                      <Link
                        href={`/factories/${factoryId}/machines/${m.machine_id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Factory view
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal
        open={lineModal}
        onClose={() => setLineModal(false)}
        title="Add production line"
        description="Use a stable ID (e.g. line-A). Name is shown in the UI."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createLine.mutate();
          }}
        >
          <Field label="Line ID">
            <Input
              required
              value={lineForm.line_id}
              placeholder="line-A"
              onChange={(e) => setLineForm({ ...lineForm, line_id: e.target.value })}
            />
          </Field>
          <Field label="Display name">
            <Input
              value={lineForm.name}
              placeholder="Weaving hall A"
              onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
            />
          </Field>
          {message && lineModal && <p className="text-sm text-red-600">{message}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={createLine.isPending}>
              {createLine.isPending ? 'Creating…' : 'Create line'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setLineModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={machineModal}
        onClose={() => setMachineModal(false)}
        title="Onboard machine"
        description="Machine ID must be unique across the platform."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMachine.mutate();
          }}
        >
          <Field label="Line">
            <Select
              required
              value={machineForm.line_id}
              onChange={(e) => setMachineForm({ ...machineForm, line_id: e.target.value })}
            >
              <option value="">Select line</option>
              {lines.map((l) => (
                <option key={l.line_id} value={l.line_id}>
                  {l.name ?? l.line_id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Machine ID">
            <Input
              required
              value={machineForm.machine_id}
              placeholder="loom-12"
              onChange={(e) => setMachineForm({ ...machineForm, machine_id: e.target.value })}
            />
          </Field>
          <Field label="Name">
            <Input
              required
              value={machineForm.name}
              onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <Input
              value={machineForm.type}
              onChange={(e) => setMachineForm({ ...machineForm, type: e.target.value })}
            />
          </Field>
          <UnitFields
            rotations={machineForm.rotations_per_unit}
            label={machineForm.unit_label}
            onRotations={(v) => setMachineForm({ ...machineForm, rotations_per_unit: v })}
            onLabel={(v) => setMachineForm({ ...machineForm, unit_label: v })}
          />
          {message && machineModal && <p className="text-sm text-red-600">{message}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={createMachine.isPending}>
              {createMachine.isPending ? 'Creating…' : 'Create machine'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMachineModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={unitEdit !== null}
        onClose={() => setUnitEdit(null)}
        title={`Production unit · ${unitEdit?.machine.name ?? ''}`}
        description="Units produced = proximity pulses ÷ rotations per unit. Applies to every report and chart of this machine, past shifts included."
      >
        {unitEdit && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              updateUnits.mutate(unitEdit);
            }}
          >
            <UnitFields
              rotations={unitEdit.rotations_per_unit}
              label={unitEdit.unit_label}
              onRotations={(v) => setUnitEdit({ ...unitEdit, rotations_per_unit: v })}
              onLabel={(v) => setUnitEdit({ ...unitEdit, unit_label: v })}
            />
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={updateUnits.isPending}>
                {updateUnits.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setUnitEdit(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <AddNodeModal open={nodeModal} onClose={() => setNodeModal(false)} defaultFactoryId={factoryId} />
    </div>
  );
}

/** "1 m = 39.37 rotations", or "1 unit = 1 rotation" for machines that count every pulse. */
function unitSummary(m: Machine): string {
  const perUnit = m.rotations_per_unit ?? 1;
  return `1 ${m.unit_label || 'unit'} = ${perUnit} rotation${perUnit === 1 ? '' : 's'}`;
}

/** Rotations-per-unit and unit-name inputs, shared by the create and edit dialogs. */
function UnitFields({
  rotations,
  label,
  onRotations,
  onLabel,
}: {
  rotations: string;
  label: string;
  onRotations: (v: string) => void;
  onLabel: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Rotations per unit">
        <Input
          type="number"
          required
          min="0.0001"
          step="any"
          value={rotations}
          onChange={(e) => onRotations(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">Proximity pulses that make one unit. 1 counts every pulse.</p>
      </Field>
      <Field label="Unit">
        <Input
          maxLength={16}
          value={label}
          placeholder="m, cm, mm, pcs…"
          onChange={(e) => onLabel(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">Shown after the number, e.g. 25.4 m. Empty = units.</p>
      </Field>
    </div>
  );
}
