'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { ApiError, api } from '@/lib/api';
import {
  BOARD_NAME_MAX, NAME_MAX, addChoices, boardSlot, kindForSlot, saveBody, sensorLabel, sensorProblems, thresholdProblems,
  type SensorProblem, type SensorRow, type SensorsBoard, type SensorsDetail,
} from '@/lib/board-sensors';
import { useLineName } from '@/lib/factory-refs-context';
import type { NodeDetailResponse } from '@/lib/types';

type Mode = 'admin' | 'factory';

export type DeviceSensorsEditorProps = {
  factoryId: string;
  deviceId: string;
  /** Our staff's addresses (Nodes, Boards) or the factory's own (Sensor mapping). */
  mode: Mode;
  /** May set names, machines, on thresholds: who may change the factory's sensor mapping. */
  canWrite: boolean;
  /** May change what is fitted on the board (its channels, their calibration, the board-wide thresholds): our super admin. */
  canHardware: boolean;
  /** Called after a save (a dialog closes, say). */
  onSaved?: () => void;
};

type Row = SensorRow & { _key: string };
type Draft = { version: string; rows: Row[]; thresholds: SensorsBoard['thresholds'] | null };

let newKeys = 0;
const keyOf = (r: SensorRow) => `${r.board ? 'b' : 'l'}:${boardSlot(r.slot) ?? r.slot}|${r.sensor_type}`;
const fromSensors = (s: SensorsDetail): Draft => ({
  version: s.version,
  rows: s.rows.map((r) => ({ ...r, _key: keyOf(r) })),
  thresholds: s.board?.managed ? { ...s.board.thresholds } : null,
});

/**
 * A device's sensors: ONE list and ONE way to change it, in the staff console's Boards and Nodes pages and in a
 * factory's Sensor mapping (the owner, 2026-11-27: "all three places should be consistent", the Boards page's
 * way; saving "very precisely", "reliable"). Each row is a channel of the board with the machine it measures, or
 * a link of its own (a Modbus sensor, a node's own channel). What the server says is wrong shows on its row, and
 * so does what it would say: nothing is sent while there is a problem. A save is one transaction on the server,
 * against the version loaded here: changed meanwhile (another save, calibration), it is refused, never merged.
 */
export function DeviceSensorsEditor(props: DeviceSensorsEditorProps) {
  return <SensorsDraft key={`${props.mode}:${props.factoryId}:${props.deviceId}`} {...props} />;
}

function SensorsDraft({ factoryId, deviceId, mode, canWrite, canHardware, onSaved }: DeviceSensorsEditorProps) {
  const qc = useQueryClient();
  const lineName = useLineName();   // the staff console has no factory context: the line's ID then
  const queryKey = useMemo(() => ['node-detail', mode, factoryId, deviceId], [mode, factoryId, deviceId]);
  const detailQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => (mode === 'admin' ? api.adminNodeDetail(factoryId, deviceId, { signal }) : api.nodeDetail(factoryId, deviceId, { signal })),
    // a save is made against what is there now: asked again whenever the editor opens
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  const detail = detailQuery.data;
  const sensors = detail?.sensors ?? null;

  // The changes, made on the list as loaded; none yet: the list as loaded.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [serverProblems, setServerProblems] = useState<SensorProblem[]>([]);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string; stale?: boolean } | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);

  const loaded = useMemo(() => (sensors ? fromSensors(sensors) : null), [sensors]);
  const current = draft ?? loaded;
  const board = sensors?.board ?? null;
  const machines = useMemo(() => detail?.machines ?? [], [detail]);
  const machineIds = useMemo(() => new Set(machines.map((m) => m.machine_id)), [machines]);
  const hardware = canHardware && Boolean(board?.managed);

  const problems = useMemo(() => (current ? sensorProblems(current.rows, machineIds) : []), [current, machineIds]);
  const boardWide = useMemo(() => [
    ...(current?.thresholds && hardware ? thresholdProblems(current.thresholds).map((message) => ({ row: null, message })) : []),
    ...problems.filter((p) => p.row === null),
    ...serverProblems.filter((p) => p.row === null),
  ], [current, hardware, problems, serverProblems]);
  const rowProblems = (i: number) => [...problems, ...serverProblems].filter((p) => p.row === i).map((p) => p.message);
  const dirty = draft !== null;
  const blocked = problems.length > 0 || boardWide.length > 0;

  const edit = (change: (d: Draft) => Draft) => {
    if (!loaded) return;
    setServerProblems([]);
    setNotice(null);
    setDraft((d) => change(d ?? loaded));
  };
  const setRow = (key: string, patch: Partial<SensorRow>) =>
    edit((d) => ({ ...d, rows: d.rows.map((r) => (r._key === key ? { ...r, ...patch } : r)) }));

  const save = useMutation({
    mutationFn: () => api.saveDeviceSensors(mode, factoryId, deviceId, saveBody(current!.version, current!.rows, hardware ? current!.thresholds : null)),
    onSuccess: (res) => {
      // the saved list, as the server has it now, is what every editor of this device shows
      for (const m of ['admin', 'factory'] as const) {
        qc.setQueryData<NodeDetailResponse>(['node-detail', m, factoryId, deviceId], (prev) => (prev ? { ...prev, sensors: res.sensors } : prev));
      }
      void qc.invalidateQueries({ queryKey: ['node-detail'] });
      void qc.invalidateQueries({ queryKey: ['factory-nodes', factoryId] });
      void qc.invalidateQueries({ queryKey: ['admin-devices'] });
      void qc.invalidateQueries({ queryKey: ['admin-boards'] });
      setDraft(null);
      setServerProblems([]);
      setNotice({ tone: 'good', text: res.sent ? 'Saved. The board was sent its new settings.' : 'Saved.' });
      onSaved?.();
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        setNotice({ tone: 'bad', text: err.message, stale: true });
        return;
      }
      const body = err instanceof ApiError ? (err.body as { problems?: SensorProblem[] } | null) : null;
      if (body?.problems?.length) setServerProblems(body.problems);
      setNotice({ tone: 'bad', text: err.message });
    },
  });

  const reload = async () => {
    setDraft(null);
    setServerProblems([]);
    setNotice(null);
    await detailQuery.refetch();
  };

  if (detailQuery.isLoading) return <TableSkeleton rows={4} cols={7} />;
  if (detailQuery.isError || !detail) {
    return <p className="text-sm text-red-600">{(detailQuery.error as Error)?.message ?? 'Device not found'}</p>;
  }
  if (!current) {
    return <p className="text-sm text-muted">This server does not list sensors this way yet. Reload the page in a minute.</p>;
  }

  const choices = canWrite ? addChoices({ rows: current.rows, board, canHardware: hardware, discovered: detail.discovered_channels ?? [] }) : [];
  const editable = (r: Row) => canWrite && (!r.board || Boolean(board));
  const machineOption = (m: { machine_id: string; name: string; line_id: string }) => `${m.name} (${lineName(m.line_id)})`;

  return (
    <div>
      {board && !board.managed && (
        <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          This board&apos;s channels were never set from FloorBeat: it runs its own (I1–I4 current, P1–P2 proximity).
          Machines can be linked to them here; set its channels when you claim it on the Boards page.
        </p>
      )}
      {board && (
        <p className="mb-2 text-xs text-muted">
          Board {board.board_id}{board.firmware ? ` · firmware ${board.firmware}` : ''}. Names, on thresholds and channels are sent to the board when they change.
        </p>
      )}

      <Table className="border-0">
        <THead>
          <TR>
            <TH>Slot</TH>
            <TH>Sensor</TH>
            <TH>Name</TH>
            <TH>Machine</TH>
            <TH>On above (A)</TH>
            <TH>Calibration / option</TH>
            <TH>On</TH>
            {canWrite && <TH />}
          </TR>
        </THead>
        <TBody>
          {current.rows.map((r, i) => {
            const messages = rowProblems(i);
            const kind = r.board ? kindForSlot(r.slot) : null;
            const notOnBoard = !r.board && Boolean(board?.managed) && boardSlot(r.slot) !== null;
            return [
              <TR key={r._key}>
                <TD className="whitespace-nowrap font-mono text-xs">
                  {r.slot || '(single)'}
                  {notOnBoard && <Badge className="ml-1 bg-amber-100 text-amber-800">not on the board</Badge>}
                </TD>
                <TD className="whitespace-nowrap text-xs">{sensorLabel(r)}</TD>
                <TD>
                  <Input
                    aria-label={`${r.slot || 'Sensor'} name`}
                    value={r.name}
                    maxLength={NAME_MAX}
                    disabled={!editable(r)}
                    title={r.board ? `The board keeps its first ${BOARD_NAME_MAX} characters` : undefined}
                    onChange={(e) => setRow(r._key, { name: e.target.value })}
                  />
                </TD>
                <TD>
                  <Select
                    aria-label={`${r.slot || 'Sensor'} machine`}
                    value={r.machine_id ?? ''}
                    disabled={!editable(r)}
                    onChange={(e) => setRow(r._key, { machine_id: e.target.value || null })}
                  >
                    <option value="">{r.board ? '— no machine —' : '— pick a machine —'}</option>
                    {machines.map((m) => <option key={m.machine_id} value={m.machine_id}>{machineOption(m)}</option>)}
                  </Select>
                </TD>
                <TD>
                  {r.sensor_type === 'current' ? (
                    <Input
                      aria-label={`${r.slot || 'Sensor'} on threshold`}
                      type="number" step="0.01" min={0}
                      value={r.on_threshold_a ?? ''}
                      disabled={!editable(r)}
                      onChange={(e) => setRow(r._key, { on_threshold_a: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  ) : <span className="text-xs text-muted">—</span>}
                </TD>
                <TD>
                  {kind === 'current' && (hardware
                    ? <Input aria-label={`${r.slot} calibration`} type="number" step="0.1" value={r.cal ?? ''} title="CT turns / burden scale (30 for SCT-013-030)" onChange={(e) => setRow(r._key, { cal: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    : <span className="text-xs text-muted">{r.cal ?? '—'}</span>)}
                  {kind === 'proximity' && (hardware
                    ? <Input aria-label={`${r.slot} debounce`} type="number" placeholder="debounce µs (10000)" value={r.debounce_us ?? ''} title="The sensor must be clear this long (µs) before the next object counts. Default 10000 (10 ms). Firmware 2.3.2+" onChange={(e) => setRow(r._key, { debounce_us: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    : <span className="text-xs text-muted">{r.debounce_us !== undefined ? `${r.debounce_us} µs` : '—'}</span>)}
                  {kind === 'ds18b20' && (hardware
                    ? <Input aria-label={`${r.slot} ROM`} placeholder="sensor ROM (optional)" value={r.rom ?? ''} onChange={(e) => setRow(r._key, { rom: e.target.value || undefined })} />
                    : <span className="text-xs text-muted">{r.rom ?? '—'}</span>)}
                  {!kind && <span className="text-xs text-muted">—</span>}
                </TD>
                <TD>
                  <input
                    type="checkbox"
                    aria-label={`${r.slot || 'Sensor'} on`}
                    checked={r.enabled}
                    disabled={!editable(r) || !r.machine_id}
                    onChange={(e) => setRow(r._key, { enabled: e.target.checked })}
                  />
                </TD>
                {canWrite && (
                  <TD>
                    {(!r.board || hardware) && (
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}>Remove</Button>
                    )}
                  </TD>
                )}
              </TR>,
              messages.length > 0 && (
                <TR key={`${r._key}:problems`}>
                  <td colSpan={canWrite ? 8 : 7} className="px-2 pb-3 text-xs text-red-700 sm:px-3" role="alert">{messages.join(' · ')}</td>
                </TR>
              ),
            ];
          })}
          {current.rows.length === 0 && (
            <TR><td colSpan={canWrite ? 8 : 7} className="px-2 py-3 text-sm text-muted sm:px-3">No sensors yet.</td></TR>
          )}
        </TBody>
      </Table>

      {canWrite && choices.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <Select
            aria-label="Add a sensor"
            value=""
            onChange={(e) => {
              const choice = choices.find((c) => c.key === e.target.value);
              if (choice) edit((d) => ({ ...d, rows: [...d.rows, { ...choice.row, _key: `new-${++newKeys}` }] }));
            }}
          >
            <option value="">Add a sensor…</option>
            {choices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </div>
      )}

      {hardware && current.thresholds && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Machine on above (A), board-wide">
            <Input
              type="number" step="0.01" value={current.thresholds.on_amps}
              onChange={(e) => edit((d) => ({ ...d, thresholds: { ...d.thresholds!, on_amps: Number(e.target.value) } }))}
            />
          </Field>
          <Field label="Samples to confirm a change">
            <Input
              type="number" value={current.thresholds.confirm_samples}
              onChange={(e) => edit((d) => ({ ...d, thresholds: { ...d.thresholds!, confirm_samples: Number(e.target.value) } }))}
            />
          </Field>
        </div>
      )}

      {boardWide.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-red-700" role="alert">{boardWide.map((p) => <li key={p.message}>{p.message}</li>)}</ul>
      )}

      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button disabled={!dirty || blocked || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          {dirty && !save.isPending && (
            <Button variant="secondary" onClick={() => { setDraft(null); setServerProblems([]); setNotice(null); }}>Discard changes</Button>
          )}
          {dirty && blocked && <span className="text-xs text-red-700">Fix the problems shown to save.</span>}
          {dirty && !blocked && !save.isPending && <span className="text-xs text-muted">Unsaved changes.</span>}
        </div>
      )}
      {notice && (
        <p className={`mt-2 text-sm ${notice.tone === 'good' ? 'text-emerald-700' : 'text-red-700'}`} role="status">
          {notice.text}
          {notice.stale && (
            <Button size="sm" variant="secondary" className="ml-2" onClick={() => void reload()}>Reload</Button>
          )}
        </p>
      )}

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.slot || 'this sensor'}?`}
        description={removing?.board
          ? 'The board stops measuring this channel once you save, and its machine link goes with it.'
          : 'Its machine stops getting these readings once you save.'}
      >
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              const key = removing?._key;
              setRemoving(null);
              if (key) edit((d) => ({ ...d, rows: d.rows.filter((r) => r._key !== key) }));
            }}
          >
            Remove
          </Button>
          <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
