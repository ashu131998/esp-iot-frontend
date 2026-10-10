'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import type { SensorBinding } from '@/lib/types';

const SENSOR_TYPES = ['current', 'proximity', 'cycle', 'time'] as const;

type BindingDraft = {
  _key: string;
  channel_slot: string;
  sensor_type: string;
  label: string;
  machine_id: string;
  on_threshold_a: number;
};

function emptyBinding(): BindingDraft {
  return {
    _key: Math.random().toString(36).slice(2),
    channel_slot: 'I1',
    sensor_type: 'current',
    label: '',
    machine_id: '',
    on_threshold_a: 0.12,
  };
}

export function AddNodeModal({
  open,
  onClose,
  defaultFactoryId,
}: {
  open: boolean;
  onClose: () => void;
  defaultFactoryId?: string;
}) {
  const qc = useQueryClient();
  const [factoryId, setFactoryId] = useState(defaultFactoryId ?? '');
  const [lineId, setLineId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceType, setDeviceType] = useState('node');
  const [bindings, setBindings] = useState<BindingDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open && defaultFactoryId) setFactoryId(defaultFactoryId);
  }, [open, defaultFactoryId]);

  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
    enabled: open,
  });

  const linesQuery = useQuery({
    queryKey: ['factory-lines', factoryId],
    enabled: open && Boolean(factoryId),
    queryFn: ({ signal }) => api.lines(factoryId, { limit: 200, offset: 0 }, { signal }),
  });

  const machinesQuery = useQuery({
    queryKey: ['factory-machines', factoryId],
    enabled: open && Boolean(factoryId),
    queryFn: ({ signal }) => api.machines(factoryId, undefined, { signal }),
  });

  const machines = machinesQuery.data?.machines ?? [];
  const lines = linesQuery.data?.lines ?? [];

  const machinesOnLine = useMemo(
    () => (lineId ? machines.filter((m) => m.line_id === lineId) : machines),
    [machines, lineId],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payloadBindings: SensorBinding[] = bindings
        .filter((b) => b.machine_id && b.label.trim())
        .map((b, i) => ({
          channel_slot: b.channel_slot.trim(),
          sensor_type: b.sensor_type,
          label: b.label.trim(),
          machine_id: b.machine_id,
          on_threshold_a: b.sensor_type === 'current' ? b.on_threshold_a : null,
          enabled: true,
          sort_order: i,
        }));
      return api.adminRegisterDevice({
        factory_id: factoryId,
        line_id: lineId,
        device_id: deviceId.trim(),
        device_type: deviceType.trim() || 'node',
        bindings: payloadBindings,
      });
    },
    onSuccess: async (detail) => {
      await qc.invalidateQueries({ queryKey: ['admin-devices'] });
      await qc.invalidateQueries({ queryKey: ['factory-nodes', factoryId] });
      setMessage(null);
      onClose();
      setDeviceId('');
      setBindings([]);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  function resetAndClose() {
    setMessage(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Register node"
      description="Pre-register an ESP before it connects. Optionally map sensor channels to machines — same as the Sensors tab."
      className="max-w-2xl"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!factoryId || !lineId || !deviceId.trim()) {
            setMessage('Factory, line, and node ID are required.');
            return;
          }
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Factory">
            <Select
              required
              value={factoryId}
              onChange={(e) => {
                setFactoryId(e.target.value);
                setLineId('');
              }}
            >
              <option value="">Select factory</option>
              {(factoriesQuery.data?.factories ?? []).map((f) => (
                <option key={f.factory_id} value={f.factory_id}>
                  {f.name ?? f.factory_id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Line">
            <Select
              required
              value={lineId}
              disabled={!factoryId}
              onChange={(e) => setLineId(e.target.value)}
            >
              <option value="">{factoryId ? 'Select line' : 'Pick factory first'}</option>
              {lines.map((l) => (
                <option key={l.line_id} value={l.line_id}>
                  {l.name ?? l.line_id}
                </option>
              ))}
            </Select>
            {factoryId && lines.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                No lines yet —{' '}
                <Link href={`/internal/factories/${factoryId}`} className="text-primary hover:underline">
                  add a line on the factory setup page
                </Link>
                .
              </p>
            )}
          </Field>
          <Field label="Node ID">
            <Input
              required
              className="font-mono text-sm"
              placeholder="loom-node-042"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />
          </Field>
          <Field label="Device type">
            <Input value={deviceType} onChange={(e) => setDeviceType(e.target.value)} placeholder="node" />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Sensor → machine mapping</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!factoryId || machines.length === 0}
              onClick={() => setBindings((b) => [...b, emptyBinding()])}
            >
              Add channel
            </Button>
          </div>
          {bindings.length === 0 ? (
            <p className="text-sm text-muted">Optional — add rows to bind I1, P1, etc. to machines.</p>
          ) : (
            <div className="space-y-2">
              {bindings.map((row, idx) => (
                <div key={row._key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5">
                  <input
                    className="rounded border px-2 py-1 font-mono text-xs"
                    placeholder="I1"
                    value={row.channel_slot}
                    onChange={(e) => {
                      const next = [...bindings];
                      next[idx] = { ...row, channel_slot: e.target.value };
                      setBindings(next);
                    }}
                  />
                  <select
                    className="rounded border px-2 py-1 text-xs"
                    value={row.sensor_type}
                    onChange={(e) => {
                      const next = [...bindings];
                      next[idx] = { ...row, sensor_type: e.target.value };
                      setBindings(next);
                    }}
                  >
                    {SENSOR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded border px-2 py-1 text-sm sm:col-span-1"
                    placeholder="Label"
                    value={row.label}
                    onChange={(e) => {
                      const next = [...bindings];
                      next[idx] = { ...row, label: e.target.value };
                      setBindings(next);
                    }}
                  />
                  <select
                    className="rounded border px-2 py-1 text-sm sm:col-span-2"
                    value={row.machine_id}
                    onChange={(e) => {
                      const next = [...bindings];
                      next[idx] = { ...row, machine_id: e.target.value };
                      setBindings(next);
                    }}
                  >
                    <option value="">Machine</option>
                    {machinesOnLine.map((m) => (
                      <option key={m.machine_id} value={m.machine_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-xs text-red-600 sm:col-span-5 sm:text-left"
                    onClick={() => setBindings(bindings.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {message && <p className="text-sm text-red-600">{message}</p>}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Register node'}
          </Button>
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
