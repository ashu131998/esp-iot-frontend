'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { NodeDetailResponse, SensorBinding } from '@/lib/types';

const SENSOR_TYPES = ['current', 'proximity', 'cycle', 'time'] as const;

function sensorTypeLabel(type: string) {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function usesOnThreshold(type: string) {
  return type === 'current';
}

type DraftBinding = SensorBinding & { _key: string };

function emptyRow(deviceId: string): DraftBinding {
  return {
    _key: `new-${Math.random().toString(36).slice(2)}`,
    device_id: deviceId,
    channel_slot: '',
    sensor_type: 'current',
    label: '',
    machine_id: '',
    on_threshold_a: 0.12,
    enabled: true,
    sort_order: 0,
  };
}

function toDraft(b: SensorBinding): DraftBinding {
  return {
    ...b,
    _key: b.binding_id ?? `${b.channel_slot}:${b.sensor_type}`,
  };
}

export function NodeSensorBindingsEditor({
  factoryId,
  deviceId,
  apiMode,
  canWrite,
}: {
  factoryId: string;
  deviceId: string;
  apiMode: 'admin' | 'factory';
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ['node-detail', apiMode, factoryId, deviceId];

  const detailQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiMode === 'admin'
        ? api.adminNodeDetail(factoryId, deviceId, { signal })
        : api.nodeDetail(factoryId, deviceId, { signal }),
  });

  const [rows, setRows] = useState<DraftBinding[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const detail = detailQuery.data;
  const machines = detail?.machines ?? [];

  useEffect(() => {
    if (detail && rows === null) {
      setRows(
        detail.bindings.length > 0
          ? detail.bindings.map(toDraft)
          : [emptyRow(deviceId)],
      );
    }
  }, [detail, deviceId, rows]);

  const discovered = detail?.discovered_channels ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = (rows ?? []).map((r, i) => ({
        binding_id: r.binding_id,
        channel_slot: r.channel_slot ?? '',
        sensor_type: r.sensor_type,
        label: r.label.trim(),
        machine_id: r.machine_id,
        on_threshold_a: usesOnThreshold(r.sensor_type)
          ? r.on_threshold_a != null
            ? Number(r.on_threshold_a)
            : null
          : null,
        enabled: r.enabled !== false,
        sort_order: i,
      }));
      if (apiMode === 'admin') {
        return api.adminReplaceNodeSensorBindings(factoryId, deviceId, payload);
      }
      return api.replaceNodeSensorBindings(factoryId, deviceId, payload);
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ['sensor-bindings', factoryId] });
      setRows((res.bindings ?? []).map(toDraft));
      setMessage('Sensor mapping saved.');
    },
    onError: (e: Error) => setMessage(e.message),
  });

  function importDiscovered() {
    const existing = new Set((rows ?? []).map((r) => `${r.channel_slot}:${r.sensor_type}`));
    const added: DraftBinding[] = [];
    for (const ch of discovered) {
      const key = `${ch.channel_slot}:${ch.sensor_type}`;
      if (existing.has(key)) continue;
      added.push({
        _key: key,
        device_id: deviceId,
        channel_slot: ch.channel_slot,
        sensor_type: ch.sensor_type,
        label: ch.sample_name ?? (ch.channel_slot || 'Channel'),
        machine_id: '',
        on_threshold_a: ch.sensor_type === 'current' ? 0.12 : null,
        enabled: true,
      });
    }
    setRows([...(rows ?? []), ...added]);
    setMessage(added.length ? `Added ${added.length} channel(s) from telemetry.` : 'No new channels to import.');
  }

  const machineName = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.machine_id, m.name])),
    [machines],
  );

  if (detailQuery.isLoading) {
    return <TableSkeleton rows={4} cols={6} />;
  }
  if (detailQuery.isError || !detail) {
    return <p className="text-sm text-red-600">{(detailQuery.error as Error)?.message ?? 'Node not found'}</p>;
  }

  return (
    <Card className="p-6">
      <CardHeader
        title="Sensor → machine mapping"
        description="Each row is one telemetry stream on this node (channel + type). Assign a machine and label — factory uptime and status use these bindings."
      />
      {discovered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Seen on wire:</span>
          {discovered.map((c) => (
            <Badge key={`${c.channel_slot}-${c.sensor_type}`} className="bg-slate-100 text-slate-800">
              {c.channel_slot || 'default'} · {sensorTypeLabel(c.sensor_type)}
              {c.sample_name ? ` (${c.sample_name})` : ''}
            </Badge>
          ))}
          {canWrite && (
            <button
              type="button"
              className="text-primary text-sm hover:underline"
              onClick={importDiscovered}
            >
              Import into table
            </button>
          )}
        </div>
      )}

      <Table className="mt-4 border-0">
        <THead>
          <TR>
            <TH>Channel</TH>
            <TH>Type</TH>
            <TH>Label</TH>
            <TH>Machine</TH>
            <TH>On threshold</TH>
            <TH>On</TH>
            {canWrite && <TH />}
          </TR>
        </THead>
        <TBody>
          {(rows ?? []).map((row, idx) => (
            <TR key={row._key}>
              <TD>
                <input
                  className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                  disabled={!canWrite}
                  placeholder="I1"
                  value={row.channel_slot}
                  onChange={(e) => {
                    const next = [...(rows ?? [])];
                    next[idx] = { ...row, channel_slot: e.target.value };
                    setRows(next);
                  }}
                />
              </TD>
              <TD>
                <select
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                  disabled={!canWrite}
                  value={row.sensor_type}
                  onChange={(e) => {
                    const next = [...(rows ?? [])];
                    const sensor_type = e.target.value;
                    next[idx] = {
                      ...row,
                      sensor_type,
                      on_threshold_a: usesOnThreshold(sensor_type) ? row.on_threshold_a ?? 0.12 : null,
                    };
                    setRows(next);
                  }}
                >
                  {SENSOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {sensorTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </TD>
              <TD>
                <input
                  className="min-w-[8rem] rounded border border-slate-200 px-2 py-1 text-sm"
                  disabled={!canWrite}
                  placeholder="Main motor"
                  value={row.label}
                  onChange={(e) => {
                    const next = [...(rows ?? [])];
                    next[idx] = { ...row, label: e.target.value };
                    setRows(next);
                  }}
                />
              </TD>
              <TD>
                <select
                  className="max-w-[12rem] rounded border border-slate-200 px-2 py-1 text-sm"
                  disabled={!canWrite}
                  value={row.machine_id}
                  onChange={(e) => {
                    const next = [...(rows ?? [])];
                    next[idx] = { ...row, machine_id: e.target.value };
                    setRows(next);
                  }}
                >
                  <option value="">— select —</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.name} ({m.line_id})
                    </option>
                  ))}
                </select>
              </TD>
              <TD>
                {usesOnThreshold(row.sensor_type) ? (
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                    disabled={!canWrite}
                    value={row.on_threshold_a ?? ''}
                    onChange={(e) => {
                      const next = [...(rows ?? [])];
                      next[idx] = {
                        ...row,
                        on_threshold_a: e.target.value === '' ? null : Number(e.target.value),
                      };
                      setRows(next);
                    }}
                  />
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </TD>
              <TD>
                <input
                  type="checkbox"
                  disabled={!canWrite}
                  checked={row.enabled !== false}
                  onChange={(e) => {
                    const next = [...(rows ?? [])];
                    next[idx] = { ...row, enabled: e.target.checked };
                    setRows(next);
                  }}
                />
              </TD>
              {canWrite && (
                <TD>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setRows((rows ?? []).filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      {canWrite && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            onClick={() => setRows([...(rows ?? []), emptyRow(deviceId)])}
          >
            Add sensor row
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save mapping'}
          </button>
        </div>
      )}

      {(rows ?? []).some((r) => r.machine_id) && (
        <p className="mt-3 text-xs text-muted">
          Preview:{' '}
          {(rows ?? [])
            .filter((r) => r.machine_id && r.label)
            .map((r) => `${machineName[r.machine_id] ?? r.machine_id}: ${r.label}`)
            .join(' · ') || '—'}
        </p>
      )}
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
    </Card>
  );
}
