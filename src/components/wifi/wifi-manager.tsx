'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, Trash2, Wifi } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SummaryCard, TONE_DOT, type Tone as DotTone } from '@/components/ui/simple';
import { PHONE_HIDDEN, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Tone } from '@/lib/board-status';
import { formatDate } from '@/lib/utils';
import {
  MAX_NETWORKS, boardsOn, dropReason, listChanged, listProblem, listStatus, networkProblem, readiness, signal,
  type WifiNetwork, type WifiPage,
} from '@/lib/wifi';

const dotTone = (t: Tone): DotTone => (t === 'neutral' ? 'idle' : t);

function ToneText({ label, tone, title }: { label: string; tone: Tone; title?: string }) {
  return (
    <span className="inline-flex items-start gap-2 text-sm" title={title}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[dotTone(tone)]}`} />
      {label}
    </span>
  );
}

/**
 * A factory's WiFi for its boards (firmware 2.4+), in the factory app and in ops: the networks,
 * whether every board has the latest list, and the steps for changing WiFi without losing a board.
 */
export function WifiManager({ factoryId }: { factoryId: string }) {
  const qc = useQueryClient();
  const key = ['factory-wifi', factoryId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.factoryWifi(factoryId, { signal }),
    refetchInterval: 10_000,
  });
  const [draft, setDraft] = useState<WifiNetwork[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (networks: WifiNetwork[]) => api.saveFactoryWifi(factoryId, networks),
    onSuccess: (page: WifiPage) => {
      qc.setQueryData(key, page);
      setDraft(null);
      const sent = page.sent?.length ?? 0;
      const skipped = page.skipped?.length ?? 0;
      setResult(
        `Saved and sent to ${sent} board${sent === 1 ? '' : 's'}.` +
          (skipped ? ` ${skipped} not set up yet will get it with their settings.` : ''),
      );
    },
  });

  if (query.isPending) {
    return <Card><p className="text-sm text-muted">Loading the WiFi settings…</p></Card>;
  }
  if (query.isError) {
    const forbidden = (query.error as { status?: number }).status === 403;
    return (
      <Card>
        <p className="text-sm text-muted">
          {forbidden
            ? 'Only the factory’s admins and the FloorBeat super admin can see and change its WiFi, because it shows the passwords.'
            : 'Could not load the WiFi settings. Try again in a moment.'}
        </p>
      </Card>
    );
  }

  const page = query.data;
  const saved = page.networks;
  const list = draft ?? saved;
  const changed = draft !== null && listChanged(saved, draft);
  const problem = draft ? listProblem(draft) : null;
  const r = readiness(page.boards);
  const using = r.current + r.waiting + r.needsFirmware;
  const edit = (next: WifiNetwork[]) => {
    setDraft(next);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {page.boards.length === 0 ? (
        <SummaryCard tone="idle" icon={<Wifi className="h-5 w-5" />} title="No boards in this factory yet"
          subtitle="Boards get these networks when they are set up." />
      ) : r.ready ? (
        <SummaryCard tone="good" title={`All ${using} boards have the latest WiFi list`}
          subtitle="It is safe to change the WiFi on your router." />
      ) : (
        <SummaryCard
          tone="warn"
          badge={r.waiting + r.needsFirmware}
          title={`${r.current} of ${using} boards have the latest WiFi list`}
          subtitle={[
            'Wait before changing the router.',
            r.waiting ? `${r.waiting} still to receive it (a board that is off gets it when it is back).` : '',
            r.needsFirmware ? `${r.needsFirmware} need firmware 2.4 first.` : '',
          ].filter(Boolean).join(' ')}
        />
      )}

      <Card>
        <CardHeader title="How to change your WiFi without losing a board" />
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          <li>Add the new network below and press <strong>Save and send to boards</strong>. Keep the old one in the list.</li>
          <li>Wait until the line at the top turns green: every board has the latest list.</li>
          <li>Now change the WiFi on your router (or switch on the new router).</li>
          <li>
            The boards move to the new network by themselves, within about a minute. When every board below shows the
            new network, remove the old one here and save again.
          </li>
        </ol>
        <ul className="mt-4 space-y-1 text-xs text-muted">
          <li>Boards use 2.4 GHz WiFi only: they cannot see 5 GHz networks.</li>
          <li>With several networks, each board joins the strongest one it can hear.</li>
          <li>If boards already lost their WiFi (the router was changed first), add the new network here anyway and contact FloorBeat.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Networks"
          description={`Boards join the strongest of these they can hear. Up to ${MAX_NETWORKS}.`}
          action={
            <Button size="sm" onClick={() => setAdding(true)} disabled={list.length >= MAX_NETWORKS || !page.managed}>
              <Plus className="mr-1 h-4 w-4" />
              Add network
            </Button>
          }
        />
        {list.length === 0 ? (
          <p className="py-4 text-sm text-muted">No networks yet: boards use only the WiFi built into their firmware.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.map((n, i) => (
              <NetworkRow
                key={`${n.ssid}-${i}`}
                network={n}
                boardsOnIt={boardsOn(page.boards, n.ssid)}
                canEdit={page.managed}
                onRemove={() => edit(list.filter((_, j) => j !== i))}
              />
            ))}
          </ul>
        )}

        {!page.managed && (
          <p className="mt-3 text-sm text-amber-700">This server cannot reach the boards right now, so changes cannot be sent.</p>
        )}
        {changed && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => save.mutate(list)} disabled={save.isPending || problem !== null}>
              {save.isPending ? 'Sending…' : 'Save and send to boards'}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>Undo changes</Button>
            {problem && <p className="text-sm text-red-600">{problem}</p>}
            {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
          </div>
        )}
        {result && !changed && <p className="mt-3 text-sm text-emerald-700">{result}</p>}
      </Card>

      <Card>
        <CardHeader title="Boards" description="Where every board stands. Updates every 10 seconds." />
        {page.boards.length === 0 ? (
          <p className="py-4 text-sm text-muted">No boards in this factory yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Board</TH>
                <TH className={PHONE_HIDDEN}>Line</TH>
                <TH className={PHONE_HIDDEN}>Status</TH>
                <TH>Network</TH>
                <TH className={PHONE_HIDDEN}>Signal</TH>
                <TH>WiFi list</TH>
                <TH className={PHONE_HIDDEN}>Last problem</TH>
              </TR>
            </THead>
            <TBody>
              {page.boards.map((b) => {
                const sig = signal(b.online ? b.rssi : null);
                const st = listStatus(b.list, b.online);
                return (
                  <TR key={b.board_id}>
                    <TD className="font-mono text-xs">{b.board_id}</TD>
                    <TD className={PHONE_HIDDEN}>{b.line_id ?? '—'}</TD>
                    <TD className={PHONE_HIDDEN}>
                      <Badge
                        className={b.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}
                      >
                        <span title={b.last_beat_at ? `Last heard ${formatDate(b.last_beat_at)}` : undefined}>
                          {b.online ? 'Online' : 'Offline'}
                        </span>
                      </Badge>
                    </TD>
                    <TD className="text-sm">{b.ssid ?? '—'}{b.ssid && !b.online && <span className="text-muted"> (last)</span>}</TD>
                    <TD className={PHONE_HIDDEN}><ToneText label={sig.label} tone={sig.tone} /></TD>
                    <TD><ToneText label={st.label} tone={st.tone} /></TD>
                    <TD className={`text-sm text-muted ${PHONE_HIDDEN}`}>{dropReason(b.last_drop) ?? '—'}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {adding && <AddNetwork existing={list} onClose={() => setAdding(false)} onAdd={(n) => { edit([...list, n]); setAdding(false); }} />}
    </div>
  );
}

function NetworkRow({
  network: n,
  boardsOnIt,
  canEdit,
  onRemove,
}: {
  network: WifiNetwork;
  boardsOnIt: number;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3">
      {/* Phones: the name on its own line, the password and Remove below it. */}
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <p className="break-all font-medium">{n.ssid}</p>
        <p className="text-xs text-muted">{boardsOnIt} board{boardsOnIt === 1 ? '' : 's'} on it now</p>
      </div>
      <span className="flex flex-1 items-center gap-1 font-mono text-sm sm:flex-none">
        {n.pass === '' ? <span className="text-muted">Open network</span> : show ? n.pass : '••••••••'}
        {n.pass !== '' && (
          <button
            type="button"
            aria-label={show ? 'Hide password' : 'Show password'}
            className="rounded p-1 text-muted hover:text-foreground"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </span>
      <Button variant="ghost" size="sm" className="text-red-600" disabled={!canEdit} onClick={onRemove}>
        <Trash2 className="mr-1 h-4 w-4" />
        Remove
      </Button>
    </li>
  );
}

function AddNetwork({
  existing,
  onClose,
  onAdd,
}: {
  existing: WifiNetwork[];
  onClose: () => void;
  onAdd: (n: WifiNetwork) => void;
}) {
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const net = { ssid: ssid.trim(), pass };
  const problem = networkProblem(net, existing);
  return (
    <Sheet title="Add a WiFi network" onClose={onClose}>
      <div className="space-y-4">
        <Field label="WiFi name">
          <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="Exactly as your phone shows it" autoFocus />
        </Field>
        <Field label="Password">
          <div className="flex items-center gap-2">
            <Input
              type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder="Leave empty for an open network" autoComplete="new-password"
            />
            <button
              type="button" aria-label={show ? 'Hide password' : 'Show password'}
              className="rounded p-2 text-muted hover:text-foreground" onClick={() => setShow(!show)}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <p className="text-xs text-muted">
          A 2.4 GHz network. Names and passwords are case-sensitive: copy them exactly. Nothing is sent until you press
          Save and send to boards.
        </p>
        {tried && problem && <p className="text-sm text-red-600">{problem}</p>}
        <div className="flex gap-2">
          <Button onClick={() => (problem ? setTried(true) : onAdd(net))}>Add to the list</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  );
}
