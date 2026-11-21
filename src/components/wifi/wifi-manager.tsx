'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Eye, EyeOff, LifeBuoy, Lock, Plus, Trash2, Wifi } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SummaryCard, TONE_DOT, type Tone as DotTone } from '@/components/ui/simple';
import { PHONE_HIDDEN, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { BoardWifiPanel, SignalIcon, signalText } from '@/components/wifi/board-wifi-panel';
import { api } from '@/lib/api';
import type { Tone } from '@/lib/board-status';
import { boardName } from '@/lib/board-wifi';
import { useT } from '@/lib/i18n/context';
import { formatDate } from '@/lib/utils';
import {
  MAX_NETWORKS, boardsOn, editableNetworks, listChanged, listProblem, listStatus, networkProblem, onlineSummary, readiness,
  rescueCoverage, signal, type NamedNetwork, type RescueBox, type WifiBoard, type WifiNetwork, type WifiPage,
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

/** A secret shown as dots until asked for. */
function Secret({ value, label }: { value: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm">
      {show ? value : '••••••••'}
      <button
        type="button"
        aria-label={show ? `Hide ${label}` : `Show ${label}`}
        className="rounded p-1 text-muted hover:text-foreground"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  );
}

/**
 * A factory's WiFi page, kept simple (2026-11): whether its boards are online; each board, by the machines it
 * measures, opening its WiFi as on a phone (the networks it sees, Connect, Retry); the networks every board
 * of the factory keeps. Everyone of the factory sees it and connects boards; its admins (and our super
 * admin) also see the passwords, change the list and find the router steps and the rescue boxes.
 */
export function WifiManager({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const key = ['factory-wifi', factoryId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.factoryWifi(factoryId, { signal }),
    refetchInterval: 10_000,
  });
  const [open, setOpen] = useState<WifiBoard | null>(null);

  if (query.isPending) {
    return <Card><p className="text-sm text-muted">{t('Loading…')}</p></Card>;
  }
  if (query.isError) {
    return <Card><p className="text-sm text-muted">{t('Could not load the WiFi. Try again in a moment.')}</p></Card>;
  }

  const page = query.data;
  const admin = page.can_edit !== false;
  const sum = onlineSummary(page.boards);

  return (
    <div className="space-y-6">
      {sum.total === 0 ? (
        <SummaryCard tone="idle" icon={<Wifi className="h-5 w-5" />} title={t('No boards in this factory yet')}
          subtitle={t('Boards get these networks when they are set up.')} />
      ) : sum.offline.length === 0 ? (
        <SummaryCard tone="good" title={tn(sum.total, 'The board is online', 'All {count} boards are online')}
          subtitle={t('Tap a board to see its WiFi.')} />
      ) : (
        <SummaryCard tone="warn" badge={sum.offline.length}
          title={t('{online} of {total} boards online', { online: sum.online, total: sum.total })}
          subtitle={t('Offline: {names}', { names: sum.offline.map(boardName).join(', ') })} />
      )}

      <Card>
        <CardHeader title={t('Boards')} description={t('Tap a board to see the networks around it and connect it.')} />
        {page.boards.length === 0 ? (
          <p className="py-4 text-sm text-muted">{t('No boards in this factory yet.')}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {page.boards.map((b) => <BoardRow key={b.board_id} board={b} onOpen={() => setOpen(b)} />)}
          </ul>
        )}
      </Card>

      <SavedNetworks factoryId={factoryId} page={page} />

      {admin && (
        <Card>
          <details>
            <summary className="cursor-pointer text-base font-semibold tracking-tight">{t('Changing your router?')}</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>{t('Add the new network under Saved networks and press Save and send to boards. Keep the old one.')}</li>
              <li>{t('Wait until every board has the list (Saved networks says so).')}</li>
              <li>{t('Now change the router.')}</li>
              <li>{t('The boards move to the new network by themselves within about a minute. Then remove the old one.')}</li>
            </ol>
            <p className="mt-3 text-xs text-muted">{t('Boards use 2.4 GHz WiFi only: they cannot see 5 GHz networks.')}</p>
          </details>
        </Card>
      )}

      {admin && <RescueCard page={page} />}

      {open && (
        <Sheet title={boardName(open)} onClose={() => setOpen(null)}>
          <BoardWifiPanel scope={{ factoryId }} boardId={open.board_id} />
        </Sheet>
      )}
    </div>
  );
}

function BoardRow({ board: b, onOpen }: { board: WifiBoard; onOpen: () => void }) {
  const { t } = useT();
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50">
        <SignalIcon rssi={b.online ? b.rssi : null} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{boardName(b)}</span>
          <span className="block truncate text-xs text-muted">
            {b.online && b.ssid
              ? `${b.ssid} · ${signalText(t, b.rssi)}`
              : b.ssid ? t('Offline · last on {network}', { network: b.ssid }) : t('Offline')}
          </span>
        </span>
        {b.list === 'waiting' && <Badge className="bg-amber-50 text-amber-800">{t('Getting the new list')}</Badge>}
        {b.list === 'update-firmware' && <Badge className="bg-red-50 text-red-700">{t('Needs a firmware update')}</Badge>}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}

/** The networks every board of the factory keeps: its admins change them; everyone else sees their names. */
function SavedNetworks({ factoryId, page }: { factoryId: string; page: WifiPage }) {
  const { t, tn } = useT();
  const qc = useQueryClient();
  const saved = editableNetworks(page);
  const [draft, setDraft] = useState<WifiNetwork[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (networks: WifiNetwork[]) => api.saveFactoryWifi(factoryId, networks),
    onSuccess: (next: WifiPage) => {
      qc.setQueryData(['factory-wifi', factoryId], next);
      setDraft(null);
      setResult(tn(next.sent?.length ?? 0, 'Saved and sent to {count} board.', 'Saved and sent to {count} boards.'));
    },
  });
  const r = readiness(page.boards);
  const ready = r.ready || r.current + r.waiting + r.needsFirmware === 0;

  if (!saved) {
    return (
      <Card>
        <CardHeader title={t('Saved networks')} description={t('Every board in the factory can use these.')} />
        <ul className="divide-y rounded-xl border">
          {(page.networks as NamedNetwork[]).map((n) => (
            <li key={n.ssid} className="flex items-center gap-2 px-3 py-3">
              <span className="min-w-0 flex-1 truncate font-medium">{n.ssid}</span>
              {!n.open && <Lock className="h-4 w-4 text-muted" aria-label={t('Needs a password')} />}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{t('Only the factory\'s admins can change these.')}</p>
      </Card>
    );
  }

  const list = draft ?? saved;
  const changed = draft !== null && listChanged(saved, draft);
  const problem = draft ? listProblem(draft) : null;
  const edit = (next: WifiNetwork[]) => {
    setDraft(next);
    setResult(null);
  };
  return (
    <Card>
      <CardHeader
        title={t('Saved networks')}
        description={t('Every board in the factory can use these (up to {max}).', { max: MAX_NETWORKS })}
        action={
          <Button size="sm" onClick={() => setAdding(true)} disabled={list.length >= MAX_NETWORKS || !page.managed}>
            <Plus className="mr-1 h-4 w-4" />
            {t('Add network')}
          </Button>
        }
      />
      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted">{t('None yet: boards use only the WiFi built into their firmware.')}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {list.map((n, i) => (
            <NetworkRow
              key={`${n.ssid}-${i}`} network={n} boardsOnIt={boardsOn(page.boards, n.ssid)} canEdit={page.managed}
              onRemove={() => edit(list.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      {!changed && page.boards.length > 0 && (
        <p className={`mt-3 text-xs ${ready ? 'text-emerald-700' : 'text-amber-800'}`}>
          {ready
            ? t('Every board has this list.')
            : [
              r.waiting ? tn(r.waiting, '{count} board still to receive it (one that is off gets it when back).', '{count} boards still to receive it (one that is off gets it when back).') : '',
              r.needsFirmware ? tn(r.needsFirmware, '{count} board needs a firmware update first.', '{count} boards need a firmware update first.') : '',
            ].filter(Boolean).join(' ')}
        </p>
      )}
      {!page.managed && <p className="mt-3 text-sm text-amber-700">{t('This server cannot reach the boards right now, so changes cannot be sent.')}</p>}
      {changed && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => save.mutate(list)} disabled={save.isPending || problem !== null}>
            {save.isPending ? t('Sending…') : t('Save and send to boards')}
          </Button>
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>{t('Undo changes')}</Button>
          {problem && <p className="text-sm text-red-600">{problem}</p>}
          {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
        </div>
      )}
      {result && !changed && <p className="mt-3 text-sm text-emerald-700">{result}</p>}
      {adding && <AddNetwork existing={list} onClose={() => setAdding(false)} onAdd={(n) => { edit([...list, n]); setAdding(false); }} />}
    </Card>
  );
}

/**
 * Its rescue boxes: what they are for, whether every board hears one, each box's state and PIN,
 * the password a phone needs for a box's page, and the steps for when boards lost their WiFi.
 */
function RescueCard({ page }: { page: WifiPage }) {
  const { t } = useT();
  const boxes = page.boxes ?? [];
  const coverage = rescueCoverage(page.boards);
  return (
    <Card>
      <details>
      <summary className="cursor-pointer text-base font-semibold tracking-tight">{t('Rescue boxes ({count})', { count: boxes.length })}</summary>
      <p className="mb-4 mt-2 text-sm text-muted">
        If the router is changed before the list above has the new network, boards cannot connect. A rescue box hands them
        the latest list, and they move to the new network by themselves. They keep everything they measure meanwhile.
      </p>
      {boxes.length === 0 ? (
        <SummaryCard tone="idle" icon={<LifeBuoy className="h-5 w-5" />} title="No rescue box in this factory yet"
          subtitle="Ask FloorBeat for one: a small box that keeps your boards reachable if the WiFi changes unexpectedly." />
      ) : (
        <>
          {coverage.looked > 0 && (
            <p className={`mb-4 text-sm ${coverage.uncovered.length ? 'text-amber-700' : 'text-emerald-700'}`}>
              {coverage.uncovered.length
                ? `${coverage.covered} of ${coverage.looked} boards hear a rescue box. Not in range: ${coverage.uncovered.join(', ')}. Move a box closer to them, or add one.`
                : `All ${coverage.looked} boards hear a rescue box.`}
            </p>
          )}
          <BoxesTable boxes={boxes} boards={page.boards} />
          {page.rescue && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-slate-50 px-3 py-3 text-sm">
              <span>Box WiFi names start with <span className="font-mono">{page.rescue.ssid_prefix}</span></span>
              <span className="inline-flex items-center gap-2">Password <Secret value={page.rescue.password} label="password" /></span>
            </div>
          )}
          <h4 className="mt-5 text-sm font-semibold">If boards lost their WiFi (the router was changed first)</h4>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
            <li>Add the new network under <strong>Networks</strong> above and press <strong>Save and send to boards</strong>.</li>
            <li>
              Go near a rescue box with your phone and join its WiFi (the name and password are above). Its page opens by
              itself; if not, open <span className="font-mono">192.168.4.1</span>.
            </li>
            <li>Enter the box&apos;s PIN and the new WiFi&apos;s name and password. The box joins it and gets the new list.</li>
            <li>Within about 5 minutes, every board near the box takes the list and joins the new network.</li>
          </ol>
        </>
      )}
      </details>
    </Card>
  );
}

function BoxesTable({ boxes, boards }: { boxes: RescueBox[]; boards: WifiBoard[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Box</TH>
          <TH className={PHONE_HIDDEN}>Status</TH>
          <TH className={PHONE_HIDDEN}>Network</TH>
          <TH>WiFi list</TH>
          <TH className={PHONE_HIDDEN}>Nearest box for</TH>
          <TH>PIN</TH>
        </TR>
      </THead>
      <TBody>
        {boxes.map((x) => {
          const st = listStatus(x.list, x.online);
          const sig = signal(x.online ? x.rssi : null);
          const inRange = boards.filter((b) => b.rescue?.box_id === x.box_id).length;
          return (
            <TR key={x.box_id}>
              <TD className="font-mono text-xs">{x.box_id}</TD>
              <TD className={PHONE_HIDDEN}>
                <Badge className={x.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                  <span title={x.last_beat_at ? `Last heard ${formatDate(x.last_beat_at)}` : undefined}>
                    {x.online ? 'Online' : 'Offline'}
                  </span>
                </Badge>
              </TD>
              <TD className={`text-sm ${PHONE_HIDDEN}`}>
                {x.ssid ?? '—'}
                {x.ssid && x.online && sig.label !== '—' && <span className="text-muted"> · {sig.label}</span>}
                {x.ssid && !x.online && <span className="text-muted"> (last)</span>}
              </TD>
              <TD><ToneText label={st.label} tone={st.tone} /></TD>
              <TD className={`text-sm ${PHONE_HIDDEN}`}>
                {inRange} board{inRange === 1 ? '' : 's'}{x.on_it ? ` · ${x.on_it} on it now` : ''}
              </TD>
              <TD>{x.pin ? <Secret value={x.pin} label="PIN" /> : <span className="text-muted">—</span>}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
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
  const { t, tn } = useT();
  const [show, setShow] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3">
      {/* Phones: the name on its own line, the password and Remove below it. */}
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <p className="break-all font-medium">{n.ssid}</p>
        <p className="text-xs text-muted">{tn(boardsOnIt, '{count} board on it now', '{count} boards on it now')}</p>
      </div>
      <span className="flex flex-1 items-center gap-1 font-mono text-sm sm:flex-none">
        {n.pass === '' ? <span className="text-muted">{t('Open network')}</span> : show ? n.pass : '••••••••'}
        {n.pass !== '' && (
          <button
            type="button"
            aria-label={show ? t('Hide password') : t('Show password')}
            className="rounded p-1 text-muted hover:text-foreground"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </span>
      <Button variant="ghost" size="sm" className="text-red-600" disabled={!canEdit} onClick={onRemove}>
        <Trash2 className="mr-1 h-4 w-4" />
        {t('Remove')}
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
  const { t } = useT();
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const net = { ssid: ssid.trim(), pass };
  const problem = networkProblem(net, existing);
  return (
    <Sheet title={t('Add a WiFi network')} onClose={onClose}>
      <div className="space-y-4">
        <Field label={t('WiFi name')}>
          <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder={t('Exactly as a phone shows it')} autoFocus />
        </Field>
        <Field label={t('Password')}>
          <div className="flex items-center gap-2">
            <Input
              type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder={t('Empty for an open network')} autoComplete="new-password"
            />
            <button
              type="button" aria-label={show ? t('Hide password') : t('Show password')}
              className="rounded p-2 text-muted hover:text-foreground" onClick={() => setShow(!show)}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <p className="text-xs text-muted">
          {t('A 2.4 GHz network. Names and passwords are case-sensitive: copy them exactly. Nothing is sent until you press Save and send to boards.')}
        </p>
        {tried && problem && <p className="text-sm text-red-600">{problem}</p>}
        <div className="flex gap-2">
          <Button onClick={() => (problem ? setTried(true) : onAdd(net))}>{t('Add to the list')}</Button>
          <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
        </div>
      </div>
    </Sheet>
  );
}
