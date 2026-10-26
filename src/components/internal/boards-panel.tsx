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
import {
  SHARED_CLIENT_KIND, batteryClock, firmware, loginStatus, queue, restrictionPlan, serviceLoginStatus, serviceName, supply,
  timeSource, type AdminBoard, type BrokerLogins,
} from '@/lib/board-status';
import { installsRemoteUpdates, targetLabel, boardTargetOf, updateStatus, versionsFor } from '@/lib/firmware';
import { formatDate } from '@/lib/utils';

const BOARDS_KEY = ['admin-boards'];
/** Where a new REV B reports until it is claimed (firmware 2.1+). */
const UNCLAIMED = 'unclaimed';

/** The settings form (channels and thresholds), shared by the Settings and Claim dialogs. */
function SettingsFields({ draft, setDraft }: { draft: BoardSettings; setDraft: (f: (d: BoardSettings) => BoardSettings) => void }) {
  const problems = settingsProblems(draft);
  const setChannel = (i: number, patch: Partial<BoardChannel>) =>
    setDraft((d) => ({ ...d, channels: d.channels.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const removeChannel = (i: number) => setDraft((d) => ({ ...d, channels: d.channels.filter((_, j) => j !== i) }));
  const addChannel = (slot: string) => setDraft((d) => ({ ...d, channels: [...d.channels, newChannel(slot)] }));
  const free = freeSlots(draft);
  return (
    <>
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
                  {CHANNEL_SLOTS.filter((sl) => sl === c.slot || free.includes(sl)).map((sl) => (
                    <option key={sl} value={sl}>{sl}</option>
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
            {free.map((sl) => <option key={sl} value={sl}>{sl} · {KIND_LABEL[kindForSlot(sl) ?? 'current']}</option>)}
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
    </>
  );
}

function DefaultsWarning() {
  return (
    <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
      Never set from the dashboard: these are REV B defaults. Check each calibration against the CTs fitted
      (e.g. 15 for SCT-013-015) before sending — wrong values scale every reading.
    </p>
  );
}

function SettingsEditor({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BoardSettings>(() => board.settings ?? defaultBoardSettings());
  const send = useMutation({
    mutationFn: () => api.adminBoardSettings(board.board_id, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Settings · ${board.board_id}`}
      description="Sent to the board over MQTT (it keeps them across restarts and gets them again each time it connects)."
      className="max-w-3xl"
    >
      {!board.settings && <DefaultsWarning />}
      <SettingsFields draft={draft} setDraft={setDraft} />
      {send.isError && <p className="mt-3 text-xs text-red-700">{(send.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={settingsProblems(draft).length > 0 || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'Sending…' : 'Send to board'}
        </Button>
      </div>
    </Modal>
  );
}

/** Claim a new board (or move one): factory, line and settings; it gets its own login with them. */
function ClaimDialog({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  const queryClient = useQueryClient();
  const unclaimed = board.factory_id === UNCLAIMED;
  const [factoryId, setFactoryId] = useState(unclaimed ? '' : (board.factory_id ?? ''));
  const [lineId, setLineId] = useState(unclaimed ? '' : (board.line_id ?? ''));
  const [draft, setDraft] = useState<BoardSettings>(() => board.settings ?? defaultBoardSettings());
  const factoriesQuery = useQuery({ queryKey: ['admin-factories'], queryFn: ({ signal }) => api.adminFactories({ signal }) });
  const linesQuery = useQuery({
    queryKey: ['lines', factoryId],
    queryFn: ({ signal }) => api.lines(factoryId, { limit: 200, offset: 0 }, { signal }),
    enabled: Boolean(factoryId),
  });
  const claim = useMutation({
    mutationFn: () => api.adminBoardClaim(board.board_id, { factory_id: factoryId, line_id: lineId, settings: draft }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
      onClose();
    },
  });
  const ready = Boolean(factoryId && lineId) && settingsProblems(draft).length === 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={`${unclaimed ? 'Claim' : 'Move'} · ${board.board_id}`}
      description="The board gets its factory and line, these settings and a login of its own (firmware 2.1+), all at once."
      className="max-w-3xl"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Factory">
          <Select value={factoryId} onChange={(e) => { setFactoryId(e.target.value); setLineId(''); }}>
            <option value="">Choose…</option>
            {(factoriesQuery.data?.factories ?? []).map((f) => (
              <option key={f.factory_id} value={f.factory_id}>{f.name ?? f.factory_id}</option>
            ))}
          </Select>
        </Field>
        <Field label="Line">
          <Select value={lineId} disabled={!factoryId} onChange={(e) => setLineId(e.target.value)}>
            <option value="">Choose…</option>
            {(linesQuery.data?.lines ?? []).map((l) => (
              <option key={l.line_id} value={l.line_id}>{l.name ?? l.line_id}</option>
            ))}
          </Select>
        </Field>
      </div>
      {!board.settings && <DefaultsWarning />}
      <SettingsFields draft={draft} setDraft={setDraft} />
      {claim.isError && <p className="mt-3 text-xs text-red-700">{(claim.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!ready || claim.isPending} onClick={() => claim.mutate()}>
          {claim.isPending ? 'Sending…' : unclaimed ? 'Claim board' : 'Move board'}
        </Button>
      </div>
    </Modal>
  );
}

function UpdateDialog({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  const queryClient = useQueryClient();
  const releasesQuery = useQuery({ queryKey: ['admin-firmware'], queryFn: ({ signal }) => api.adminFirmware({ signal }) });
  const choices = versionsFor(releasesQuery.data?.releases ?? [], board);
  const [version, setVersion] = useState('');
  const fw = board.beat?.fw;
  const capable = installsRemoteUpdates(fw);
  const target = boardTargetOf(board);
  const send = useMutation({
    mutationFn: (v: string | null) => api.adminBoardUpdate(board.board_id, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title={`Update · ${board.board_id}`}>
      <p className="mb-3 text-sm">
        It runs <span className="font-mono">{fw ?? 'unknown firmware'}</span>{target ? ` on ${targetLabel(target)}` : ''}.
        Offered now, it gets the update when it is online, checks the signature, installs it and restarts; if the new
        firmware does not prove healthy within 30 minutes it goes back to this one.
      </p>
      {!capable ? (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          This firmware cannot install updates from the dashboard: it needs 2.2 or later, put on once over the LAN.
        </p>
      ) : choices.length === 0 ? (
        <p className="text-xs text-muted">No other release uploaded for {target ? targetLabel(target) : 'its hardware'} (Firmware page).</p>
      ) : (
        <Field label="Version">
          <Select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">Choose…</option>
            {choices.map((r) => <option key={r.version} value={r.version}>{r.version}{r.notes ? ` — ${r.notes}` : ''}</option>)}
          </Select>
        </Field>
      )}
      {send.isError && <p className="mt-3 text-xs text-red-700">{(send.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {board.ota_version && (
          <Button variant="secondary" disabled={send.isPending} onClick={() => send.mutate(null)}>
            Withdraw {board.ota_version}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!capable || !version || send.isPending} onClick={() => send.mutate(version)}>
          {send.isPending ? 'Sending…' : 'Offer update'}
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

function SharedLoginConfirm({ logins, onClose }: { logins: BrokerLogins; onClose: () => void }) {
  const queryClient = useQueryClient();
  const restrict = !logins.shared.restricted;
  const plan = restrictionPlan(logins);
  const change = useMutation({
    mutationFn: () => api.adminSharedLogin(restrict),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title={restrict ? 'Restrict the shared login' : 'Open the shared login again'}>
      {restrict ? (
        <div className="space-y-3 text-sm">
          <p>
            The shared login ({logins.shared.username}) is in every firmware image. Restricted, it only lets a new board
            report as unclaimed and receive its claim; every other board needs its own login first.
          </p>
          {plan.blockedBy.length > 0 && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-800">Not yet: {plan.blockedBy.join('; ')}. All data would stop.</p>
          )}
          {plan.cutOff.length > 0 ? (
            <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              <p className="mb-1 font-medium">Cut off until they have their own login:</p>
              <ul className="list-inside list-disc font-mono">
                {plan.cutOff.map((c) => <li key={c.clientid}>{c.clientid}{c.ip ? ` (${c.ip})` : ''}</li>)}
              </ul>
              <p className="mt-1">Boards keep their data in flash meanwhile; open it again to let them back in.</p>
            </div>
          ) : (
            <p className="text-xs text-muted">Nothing connected now would be cut off.</p>
          )}
        </div>
      ) : (
        <p className="text-sm">
          Anyone holding the shared password can then reach every factory again. Use it to let a board that was cut off
          receive its own login.
        </p>
      )}
      {change.isError && <p className="mt-3 text-xs text-red-700">{(change.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={change.isPending || (restrict && plan.blockedBy.length > 0)} onClick={() => change.mutate()}>
          {change.isPending ? 'Saving…' : restrict ? 'Restrict it' : 'Open it'}
        </Button>
      </div>
    </Modal>
  );
}

/** The server's services and the shared fleet login on the broker. */
function BrokerLoginsCard({ logins, canChange }: { logins: BrokerLogins; canChange: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const { shared } = logins;
  return (
    <Card className="p-6">
      <CardHeader
        title="Broker logins"
        description="Each board and server service gets a login of its own; the shared login is for new boards only once restricted"
        action={canChange && (
          <Button size="sm" variant={shared.restricted ? 'secondary' : 'primary'} onClick={() => setConfirming(true)}>
            {shared.restricted ? 'Open shared login' : 'Restrict shared login'}
          </Button>
        )}
      />
      <Table className="border-0">
        <THead>
          <TR><TH>Who</TH><TH>Login</TH><TH>Status</TH></TR>
        </THead>
        <TBody>
          {logins.services.map((s) => (
            <TR key={s.service}>
              <TD className="text-sm">{serviceName(s.service)}</TD>
              <TD className="font-mono text-xs">{s.username}</TD>
              <TD><StatusBadge cell={serviceLoginStatus(s)} /></TD>
            </TR>
          ))}
          <TR>
            <TD className="text-sm">Shared fleet login</TD>
            <TD className="font-mono text-xs">{shared.username}</TD>
            <TD>
              <StatusBadge cell={shared.restricted
                ? { label: 'New boards only', tone: 'good', detail: 'Only a new board reporting as unclaimed can use it' }
                : { label: 'Open', tone: 'warn', detail: 'Anyone holding the shared password (in every firmware image) reaches every factory' }}
              />
            </TD>
          </TR>
        </TBody>
      </Table>
      <div className="mt-3 text-xs">
        <p className="mb-1 font-medium">Connected with the shared login now:</p>
        {shared.clients.length === 0 ? <p className="text-muted">Nobody.</p> : (
          <ul className="space-y-0.5">
            {shared.clients.map((c) => (
              <li key={c.clientid}>
                <span className="font-mono">{c.clientid}</span>
                {c.ip && <span className="text-muted"> · {c.ip}</span>}
                <span className="text-muted"> · {SHARED_CLIENT_KIND[c.kind]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirming && <SharedLoginConfirm logins={logins} onClose={() => setConfirming(false)} />}
    </Card>
  );
}

export function BoardsPanel() {
  const { user } = useAuth();
  const canChange = isSuperAdmin(user);
  const [editing, setEditing] = useState<AdminBoard | null>(null);
  const [loginFor, setLoginFor] = useState<AdminBoard | null>(null);
  const [claiming, setClaiming] = useState<AdminBoard | null>(null);
  const [updating, setUpdating] = useState<AdminBoard | null>(null);
  const boardsQuery = useQuery({
    queryKey: BOARDS_KEY,
    queryFn: ({ signal }) => api.adminBoards({ signal }),
    refetchInterval: 15_000,
  });
  const boards = boardsQuery.data?.boards ?? [];
  const broker = boardsQuery.data?.broker;
  const logins = boardsQuery.data?.logins ?? null;

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
          <TableSkeleton rows={4} cols={12} />
        ) : boards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No boards have reported yet.</p>
        ) : (
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Board</TH><TH>Where</TH><TH>Online</TH><TH>Login</TH><TH>Firmware</TH><TH>Update</TH>
                <TH>Battery clock</TH><TH>Time</TH><TH>Queue</TH><TH>24 V</TH><TH>Last heartbeat</TH><TH>Settings</TH>
                {canChange && <TH />}
              </TR>
            </THead>
            <TBody>
              {boards.map((b) => (
                <TR key={b.board_id}>
                  <TD className="font-mono text-xs">{b.board_id}</TD>
                  <TD className="text-xs">
                    {b.factory_id === UNCLAIMED
                      ? <Badge className="bg-blue-50 text-blue-700">New — not claimed</Badge>
                      : `${b.factory_id ?? '—'} / ${b.line_id ?? '—'}`}
                  </TD>
                  <TD>
                    {b.online === null ? <span className="text-xs text-muted">—</span> : (
                      <Badge className={b.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {b.online ? 'Online' : 'Offline'}
                      </Badge>
                    )}
                  </TD>
                  <TD><StatusBadge cell={loginStatus(b)} /></TD>
                  <TD className="font-mono text-xs">{firmware(b.beat)}</TD>
                  <TD><StatusText cell={updateStatus(b)} /></TD>
                  <TD><StatusBadge cell={batteryClock(b.beat)} /></TD>
                  <TD><StatusText cell={timeSource(b.beat)} /></TD>
                  <TD><StatusText cell={queue(b.beat)} /></TD>
                  <TD><StatusText cell={supply(b.beat)} /></TD>
                  <TD className="text-xs">{b.last_beat_at ? formatDate(b.last_beat_at) : '—'}</TD>
                  <TD className="text-xs">
                    {b.settings_sent_at ? `Sent ${formatDate(b.settings_sent_at)}` : <span className="text-muted">Not set from here</span>}
                  </TD>
                  {canChange && (
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant={b.factory_id === UNCLAIMED ? 'primary' : 'secondary'} disabled={broker !== 'ok'} onClick={() => setClaiming(b)}>
                          {b.factory_id === UNCLAIMED ? 'Claim' : 'Move'}
                        </Button>
                        <Button size="sm" variant="secondary" disabled={broker !== 'ok' || b.factory_id === UNCLAIMED} onClick={() => setEditing(b)}>Settings</Button>
                        <Button
                          size="sm" variant="secondary" disabled={broker !== 'ok' || !b.settings}
                          title={b.settings ? undefined : 'Send its settings first'}
                          onClick={() => setLoginFor(b)}
                        >
                          Own login
                        </Button>
                        <Button size="sm" variant="secondary" disabled={broker !== 'ok' || b.factory_id === UNCLAIMED} onClick={() => setUpdating(b)}>
                          Update
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
      {logins && <BrokerLoginsCard logins={logins} canChange={canChange} />}
      {editing && <SettingsEditor board={editing} onClose={() => setEditing(null)} />}
      {loginFor && <LoginConfirm board={loginFor} onClose={() => setLoginFor(null)} />}
      {updating && <UpdateDialog board={updating} onClose={() => setUpdating(null)} />}
      {claiming && <ClaimDialog board={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
