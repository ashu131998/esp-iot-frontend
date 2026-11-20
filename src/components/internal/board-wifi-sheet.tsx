'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';

import { StatusText } from '@/components/internal/board-status-cells';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import type { AdminBoard } from '@/lib/board-status';
import {
  cleanOwn, currentNetwork, keepsMeasuring, ownChanged, ownProblems, roomLeft, sentStatus, type BoardWifi,
} from '@/lib/board-wifi';
import type { WifiNetwork } from '@/lib/wifi';

export const boardWifiKey = (boardId: string) => ['admin-board-wifi', boardId] as const;

/**
 * A board's own WiFi networks (super admin): add, change and remove them. They go on top of its
 * factory's list; saved, they reach the board at once (online) or when it is back (off air).
 */
export function BoardWifiSheet({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  const query = useQuery({
    queryKey: boardWifiKey(board.board_id),
    queryFn: ({ signal }) => api.adminBoardWifi(board.board_id, { signal }),
    refetchInterval: 10_000,   // whether it has applied them yet
  });
  return (
    <Sheet title={`WiFi · ${board.board_id}`} onClose={onClose}>
      {query.isError ? (
        <p className="text-sm text-red-600">{(query.error as Error).message}</p>
      ) : !query.data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        // A new version (just saved) starts the form again from what the board now has.
        <BoardWifiForm key={query.data.cfg_version} wifi={query.data} firmware={board.beat?.fw ?? null} onClose={onClose} />
      )}
    </Sheet>
  );
}

export function BoardWifiForm({ wifi, firmware, onClose }: { wifi: BoardWifi; firmware: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<WifiNetwork[]>(wifi.networks);
  const [tried, setTried] = useState(false);
  const problems = ownProblems(draft, wifi.factory_networks, wifi.max);
  const hasProblem = problems.list !== null || problems.rows.some(Boolean);
  const changed = ownChanged(wifi.networks, draft);
  const room = roomLeft(draft, wifi.factory_networks, wifi.max);
  const now = currentNetwork(wifi, draft);
  const status = sentStatus(wifi);
  const save = useMutation({
    mutationFn: () => api.saveAdminBoardWifi(wifi.board_id, cleanOwn(draft)),
    onSuccess: (saved) => {
      queryClient.setQueryData(boardWifiKey(wifi.board_id), saved);
      queryClient.invalidateQueries({ queryKey: ['admin-boards'] });
    },
  });
  const set = (i: number, patch: Partial<WifiNetwork>) => setDraft(draft.map((n, j) => (j === i ? { ...n, ...patch } : n)));

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-1">
        <StatusText cell={{ label: now.label, tone: now.tone, detail: 'From its last heartbeat' }} />
        {now.onList === false && (
          <p className="text-xs text-amber-800">
            {wifi.ssid} is not on the list it will have. It stays on it now; once it leaves it, it joins one of the networks
            below (or one built into its firmware).
          </p>
        )}
        <p>
          <StatusText cell={status} /> <span className="text-xs text-muted">{status.detail}</span>
        </p>
      </section>

      <section>
        <p className="font-medium">Its own networks</p>
        <p className="text-xs text-muted">Only this board. A name its factory also has: this board uses the password here.</p>
        {!wifi.editable ? (
          <>
            <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">{wifi.reason}</p>
            <ul className="mt-2 space-y-1">
              {wifi.networks.map((n) => <li key={n.ssid} className="font-medium">{n.ssid}</li>)}
            </ul>
          </>
        ) : (
          <div className="mt-2 space-y-3">
            {draft.length === 0 && <p className="text-xs text-muted">None: it uses its factory&apos;s networks.</p>}
            {draft.map((n, i) => (
              <OwnNetworkRow
                key={i} index={i} network={n} problem={tried ? problems.rows[i] : null}
                onChange={(patch) => set(i, patch)} onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              size="sm" variant="secondary" disabled={room === 0}
              title={room === 0 ? `A board keeps at most ${wifi.max} networks in all` : undefined}
              onClick={() => setDraft([...draft, { ssid: '', pass: '' }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add a network
            </Button>
            {problems.list && <p className="text-xs text-red-600">{problems.list}</p>}
          </div>
        )}
      </section>

      <section>
        <p className="font-medium">Its factory&apos;s networks</p>
        <p className="text-xs text-muted">Every board of {wifi.factory_id ?? 'its factory'} has these: change them on the factory&apos;s WiFi page.</p>
        {wifi.factory_networks.length === 0
          ? <p className="mt-1 text-xs text-muted">None set.</p>
          : (
            <ul className="mt-1 space-y-0.5">
              {wifi.factory_networks.map((n) => <li key={n.ssid}>{n.ssid}</li>)}
            </ul>
          )}
      </section>

      {wifi.editable && (
        <section className="space-y-3 border-t pt-4">
          <p className="text-xs text-muted">
            Saved, they go to the board at once: online, it takes them within seconds; off, as soon as it is back. It stays on
            the network it is on; the new list counts the next time it joins one. Its readings wait in its memory whenever it
            is offline, so none are lost.
          </p>
          {!keepsMeasuring(firmware) && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              It runs {firmware ?? 'an unknown firmware'}: until it is updated to 2.9.1 (Update), new settings restart its sensors,
              which can cost the minute being measured.
            </p>
          )}
          {save.isError && <p className="text-xs text-red-600">{(save.error as Error).message}</p>}
          {save.isSuccess && !changed && <p className="text-xs text-emerald-700">Sent with its settings.</p>}
          <div className="flex gap-2">
            <Button disabled={!changed || save.isPending} onClick={() => (hasProblem ? setTried(true) : save.mutate())}>
              {save.isPending ? 'Sending…' : 'Save and send'}
            </Button>
            <Button variant="ghost" onClick={onClose}>{changed ? 'Cancel' : 'Close'}</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function OwnNetworkRow({ index, network: n, problem, onChange, onRemove }: {
  index: number;
  network: WifiNetwork;
  problem: string | null;
  onChange: (patch: Partial<WifiNetwork>) => void;
  onRemove: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="WiFi name">
          <Input aria-label={`WiFi name ${index + 1}`} value={n.ssid} onChange={(e) => onChange({ ssid: e.target.value })} placeholder="Exactly as a phone shows it" />
        </Field>
        <Field label="Password">
          <div className="flex items-center gap-1">
            <Input
              aria-label={`Password ${index + 1}`} type={show ? 'text' : 'password'} value={n.pass} autoComplete="new-password"
              onChange={(e) => onChange({ pass: e.target.value })} placeholder="Empty: an open network"
            />
            <button
              type="button" aria-label={show ? 'Hide password' : 'Show password'}
              className="rounded p-2 text-muted hover:text-foreground" onClick={() => setShow(!show)}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button variant="ghost" size="sm" className="text-red-600" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          Remove
        </Button>
      </div>
      {problem && <p className="mt-1 text-xs text-red-600">{problem}</p>}
    </div>
  );
}
