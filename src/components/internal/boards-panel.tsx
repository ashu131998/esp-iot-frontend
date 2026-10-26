'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { StatusBadge, StatusText } from '@/components/internal/board-status-cells';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isSuperAdmin } from '@/lib/auth-types';
import {
  CHANNEL_SLOTS, KIND_LABEL, defaultBoardSettings, freeSlots, kindForSlot, newChannel, settingsProblems,
  type BoardChannel, type BoardSettings,
} from '@/lib/board-settings';
import { batteryClock, firmware, loginStatus, queue, supply, type AdminBoard } from '@/lib/board-status';
import { formatDate } from '@/lib/utils';

const BOARDS_KEY = ['admin-boards'];

function SettingsEditor({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BoardSettings>(() => board.settings ?? defaultBoardSettings());
  const problems = settingsProblems(draft);
  const send = useMutation({
    mutationFn: () => api.adminBoardSettings(board.board_id, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
      onClose();
    },
  });

  const setChannel = (i: number, patch: Partial<BoardChannel>) =>
    setDraft((d) => ({ ...d, channels: d.channels.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const removeChannel = (i: number) => setDraft((d) => ({ ...d, channels: d.channels.filter((_, j) => j !== i) }));
  const addChannel = (slot: string) => setDraft((d) => ({ ...d, channels: [...d.channels, newChannel(slot)] }));
  const free = freeSlots(draft);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Settings · ${board.board_id}`}
      description="Sent to the board over MQTT (it keeps them across restarts and gets them again each time it connects)."
      className="max-w-3xl"
    >
      {!board.settings && (
        <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          Never set from the dashboard: these are REV B defaults. Check each calibration against the CTs fitted
          (e.g. 15 for SCT-013-015) before sending — wrong values scale every reading.
        </p>
      )}
      <Table className="border-0">
        <THead>
          <TR>
            <TH>Slot</TH><TH>Sensor</TH><TH>Name</TH><TH>Calibration / option</TH><TH />
          </TR>
        </THead>
        <TBody>
          {draft.channels.map((c, i) => (
            <TR key={`${c.slot}-${i}`}>
              <TD>
                <Select
                  value={c.slot}
                  onChange={(e) => setChannel(i, { ...newChannel(e.target.value), name: c.name === c.slot ? e.target.value : c.name })}
                >
                  {CHANNEL_SLOTS.filter((s) => s === c.slot || free.includes(s)).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </TD>
              <TD className="text-xs">{KIND_LABEL[kindForSlot(c.slot) ?? c.type]}</TD>
              <TD>
                <Input value={c.name} maxLength={23} onChange={(e) => setChannel(i, { name: e.target.value })} />
              </TD>
              <TD>
                {c.type === 'current' && (
                  <Input
                    type="number" step="0.1" value={c.cal ?? ''} title="CT turns / burden scale (30 for SCT-013-030)"
                    onChange={(e) => setChannel(i, { cal: Number(e.target.value) })}
                  />
                )}
                {c.type === 'proximity' && (
                  <Input
                    type="number" placeholder="debounce µs (3000)" value={c.debounce_us ?? ''}
                    onChange={(e) => setChannel(i, { debounce_us: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                )}
                {c.type === 'ds18b20' && (
                  <Input
                    placeholder="sensor ROM (optional)" value={c.rom ?? ''}
                    onChange={(e) => setChannel(i, { rom: e.target.value || undefined })}
                  />
                )}
              </TD>
              <TD>
                <Button size="sm" variant="ghost" onClick={() => removeChannel(i)}>Remove</Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {free.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <Select value="" onChange={(e) => e.target.value && addChannel(e.target.value)}>
            <option value="">Add a channel…</option>
            {free.map((s) => <option key={s} value={s}>{s} · {KIND_LABEL[kindForSlot(s) ?? 'current']}</option>)}
          </Select>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Machine on above (A)">
          <Input
            type="number" step="0.01" value={draft.thresholds.on_amps}
            onChange={(e) => setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, on_amps: Number(e.target.value) } }))}
          />
        </Field>
        <Field label="Samples to confirm a change">
          <Input
            type="number" value={draft.thresholds.confirm_samples}
            onChange={(e) => setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, confirm_samples: Number(e.target.value) } }))}
          />
        </Field>
      </div>
      {problems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-red-700">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {send.isError && <p className="mt-3 text-xs text-red-700">{(send.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={problems.length > 0 || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'Sending…' : 'Send to board'}
        </Button>
      </div>
    </Modal>
  );
}

function LoginConfirm({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  const queryClient = useQueryClient();
  const issue = useMutation({
    mutationFn: () => api.adminBoardLogin(board.board_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title={`Own login · ${board.board_id}`}>
      <p className="text-sm">
        The board gets a login of its own that reaches only its own topics, sent to it once with its settings.
        It switches over by itself (firmware 2.1 and later); until then it keeps using the shared login.
        {board.own_login && ' It already has one: this replaces the password.'}
      </p>
      {issue.isError && <p className="mt-3 text-xs text-red-700">{(issue.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={issue.isPending} onClick={() => issue.mutate()}>
          {issue.isPending ? 'Sending…' : board.own_login ? 'Replace its login' : 'Give it its own login'}
        </Button>
      </div>
    </Modal>
  );
}

export function BoardsPanel() {
  const { user } = useAuth();
  const canChange = isSuperAdmin(user);
  const [editing, setEditing] = useState<AdminBoard | null>(null);
  const [loginFor, setLoginFor] = useState<AdminBoard | null>(null);
  const boardsQuery = useQuery({
    queryKey: BOARDS_KEY,
    queryFn: ({ signal }) => api.adminBoards({ signal }),
    refetchInterval: 15_000,
  });
  const boards = boardsQuery.data?.boards ?? [];
  const broker = boardsQuery.data?.broker;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title="Boards"
          description={canChange
            ? 'ESP32 boards: status, settings and their own logins'
            : 'ESP32 boards and their status (changes: super admin only)'}
        />
        {broker && broker !== 'ok' && (
          <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            {broker === 'unreachable'
              ? 'The MQTT broker is not answering: online and login columns are unknown, and nothing can be sent.'
              : 'Boards are not managed from this server (no broker here).'}
          </p>
        )}
        {boardsQuery.isError ? (
          <p className="text-sm text-red-600">{(boardsQuery.error as Error).message}</p>
        ) : boardsQuery.isPending ? (
          <TableSkeleton rows={4} cols={10} />
        ) : boards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No boards have reported yet.</p>
        ) : (
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Board</TH><TH>Where</TH><TH>Online</TH><TH>Login</TH><TH>Firmware</TH>
                <TH>Battery clock</TH><TH>Queue</TH><TH>24 V</TH><TH>Last heartbeat</TH><TH>Settings</TH>
                {canChange && <TH />}
              </TR>
            </THead>
            <TBody>
              {boards.map((b) => (
                <TR key={b.board_id}>
                  <TD className="font-mono text-xs">{b.board_id}</TD>
                  <TD className="text-xs">{b.factory_id ?? '—'} / {b.line_id ?? '—'}</TD>
                  <TD>
                    {b.online === null ? <span className="text-xs text-muted">—</span> : (
                      <Badge className={b.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {b.online ? 'Online' : 'Offline'}
                      </Badge>
                    )}
                  </TD>
                  <TD><StatusBadge cell={loginStatus(b)} /></TD>
                  <TD className="font-mono text-xs">{firmware(b.beat)}</TD>
                  <TD><StatusBadge cell={batteryClock(b.beat)} /></TD>
                  <TD><StatusText cell={queue(b.beat)} /></TD>
                  <TD><StatusText cell={supply(b.beat)} /></TD>
                  <TD className="text-xs">{b.last_beat_at ? formatDate(b.last_beat_at) : '—'}</TD>
                  <TD className="text-xs">
                    {b.settings_sent_at ? `Sent ${formatDate(b.settings_sent_at)}` : <span className="text-muted">Not set from here</span>}
                  </TD>
                  {canChange && (
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" disabled={broker !== 'ok'} onClick={() => setEditing(b)}>Settings</Button>
                        <Button
                          size="sm" variant="secondary" disabled={broker !== 'ok' || !b.settings}
                          title={b.settings ? undefined : 'Send its settings first'}
                          onClick={() => setLoginFor(b)}
                        >
                          Own login
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {editing && <SettingsEditor board={editing} onClose={() => setEditing(null)} />}
      {loginFor && <LoginConfirm board={loginFor} onClose={() => setLoginFor(null)} />}
    </div>
  );
}
