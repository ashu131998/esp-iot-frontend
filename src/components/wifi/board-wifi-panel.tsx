'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, Plus, RefreshCw, Trash2, Wifi, WifiHigh, WifiLow, WifiOff, WifiZero } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  attemptView, bars, connectNeeds, minutesAgo, networkRows, passwordOk, pollMs, scanState,
  type BoardWifi, type BoardWifiAction, type NetworkRow, type WifiProblem, type WifiScope,
} from '@/lib/board-wifi';
import { useT } from '@/lib/i18n/context';
import type { Translate } from '@/lib/i18n/translate';

export const boardWifiKey = (scope: WifiScope, boardId: string) => ['board-wifi', scope?.factoryId ?? 'ops', boardId] as const;

/** Signal bars, as on a phone (none: off air). */
export function SignalIcon({ rssi, className = 'h-5 w-5' }: { rssi: number | null; className?: string }) {
  const n = bars(rssi);
  const Icon = n === 4 ? Wifi : n === 3 ? WifiHigh : n === 2 ? WifiLow : n === 1 ? WifiZero : WifiOff;
  const tone = n >= 3 ? 'text-emerald-600' : n === 2 ? 'text-amber-600' : n === 1 ? 'text-red-600' : 'text-slate-400';
  return <Icon className={`${className} shrink-0 ${tone}`} aria-hidden />;
}

/** The signal in a word, translated. */
export function signalText(t: Translate, rssi: number | null): string {
  switch (bars(rssi)) {
    case 4: return t('Strong signal');
    case 3: return t('Good signal');
    case 2: return t('Weak signal');
    case 1: return t('Very weak signal');
    default: return '';
  }
}

function problemText(t: Translate, p: WifiProblem | null): string {
  switch (p) {
    case 'password': return t('Wrong WiFi password');
    case 'not-found': return t('Network not found: it may be too far, or 5 GHz only');
    case 'refused': return t('The router refused it');
    case 'signal': return t('The signal was lost');
    case 'no-internet': return t('No internet through it');
    case 'other': return t('It could not join it');
    default: return '';
  }
}

function seenText(t: Translate, w: BoardWifi, nowMs: number): string {
  const m = minutesAgo(w.seen_at, nowMs);
  if (m === null) return '';
  if (m < 1) return t('Seen just now');
  if (m < 60) return t('Seen {count} min ago', { count: m });
  if (m < 48 * 60) return t('Seen {count} h ago', { count: Math.floor(m / 60) });
  return t('Seen {count} days ago', { count: Math.floor(m / 1440) });
}

/** A board's WiFi as on a phone, kept up to date (every 2 s while it scans or connects). */
export function BoardWifiPanel({ scope, boardId }: { scope: WifiScope; boardId: string }) {
  const { t } = useT();
  const query = useQuery({
    queryKey: boardWifiKey(scope, boardId),
    queryFn: ({ signal }) => api.boardWifi(scope, boardId, { signal }),
    refetchInterval: (q) => (q.state.data ? pollMs(q.state.data) : 10_000),
  });
  if (query.isError) return <p className="text-sm text-red-600">{(query.error as Error).message}</p>;
  if (!query.data) return <p className="text-sm text-muted">{t('Loading…')}</p>;
  // "Seen 3 min ago" counts from when this was fetched (every 2–10 s): no clock read while rendering.
  return <BoardWifiView scope={scope} wifi={query.data} nowMs={query.dataUpdatedAt} />;
}

export function BoardWifiView({ scope, wifi, nowMs }: { scope: WifiScope; wifi: BoardWifi; nowMs: number }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [tapped, setTapped] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const act = useMutation({
    mutationFn: ({ what, body }: { what: BoardWifiAction; body?: Record<string, unknown> }) =>
      api.boardWifiAction(scope, wifi.board_id, what, body),
    onSuccess: (page) => {
      qc.setQueryData(boardWifiKey(scope, wifi.board_id), page);
      qc.invalidateQueries({ queryKey: scope ? ['factory-wifi', scope.factoryId] : ['admin-boards'] });
      setTapped(null);
      setAdding(false);
    },
  });
  const run = (what: BoardWifiAction, body?: Record<string, unknown>) => act.mutate({ what, body });
  const rows = networkRows(wifi);
  const scan = scanState(wifi);
  const attempt = attemptView(wifi);
  const connected = wifi.online && wifi.ssid;

  return (
    <div className="space-y-5 text-sm">
      {/* Where it is, as a phone's top line */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
        <SignalIcon rssi={connected ? wifi.rssi : null} className="h-6 w-6" />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {connected ? t('Connected to {network}', { network: wifi.ssid! }) : t('Offline')}
          </p>
          <p className="text-xs text-muted">
            {connected
              ? signalText(t, wifi.rssi)
              : wifi.ssid ? t('Last on {network}', { network: wifi.ssid }) : t('It has not connected yet')}
          </p>
        </div>
      </div>

      {!wifi.editable && wifi.reason && <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">{wifi.reason}</p>}
      {wifi.editable && wifi.status === 'waiting' && (
        <p className="text-xs text-amber-800">
          {wifi.online ? t('Sending it the change…') : t('It gets the change when it is back online')}
        </p>
      )}

      {attempt && (
        <AttemptBanner
          attempt={attempt} canRetry={wifi.can.connect} busy={act.isPending}
          onRetry={() => run('retry')} onPassword={(pass) => run('connect', { ssid: attempt.ssid, pass })}
        />
      )}

      <section>
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{t('Networks it can see')}</p>
          {scan !== 'unsupported' && wifi.can.connect && (
            <Button size="sm" variant="secondary" disabled={scan === 'scanning' || act.isPending} onClick={() => run('scan')}>
              <RefreshCw className={`mr-1 h-4 w-4 ${scan === 'scanning' ? 'animate-spin' : ''}`} />
              {scan === 'scanning' ? t('Scanning…') : t('Scan')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">
          {scan === 'waiting' ? t('It scans when it is back online') : seenText(t, wifi, nowMs)}
        </p>
        {scan === 'unsupported' ? (
          <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            {t('Update its firmware to 2.9.4 to see the networks around it.')}
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted">{t('None seen yet: press Scan.')}</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border">
            {rows.map((r) => (
              <NetworkItem
                key={r.ssid} row={r} tapped={tapped === r.ssid} canConnect={wifi.can.connect} busy={act.isPending}
                onTap={() => setTapped(tapped === r.ssid ? null : r.ssid)}
                onConnect={(pass) => run('connect', { ssid: r.ssid, ...(pass ? { pass } : {}), open: r.open })}
              />
            ))}
          </ul>
        )}
      </section>

      {act.isError && <p className="text-xs text-red-600">{(act.error as Error).message}</p>}

      <section>
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{t('Saved networks')}</p>
          {wifi.can.manage && !adding && (
            <Button size="sm" variant="ghost" disabled={wifi.room === 0} onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('Add a network')}
            </Button>
          )}
        </div>
        {adding && <AddNetwork busy={act.isPending} onCancel={() => setAdding(false)} onAdd={(ssid, pass) => run('add', { ssid, pass, open: pass === '' })} />}
        {wifi.saved.length === 0 ? (
          <p className="mt-1 text-xs text-muted">{t('None yet.')}</p>
        ) : (
          <ul className="mt-1 divide-y">
            {wifi.saved.map((n) => (
              <li key={n.ssid} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate">{n.ssid}</span>
                <span className="text-xs text-muted">{n.own ? t('This board only') : t('Whole factory')}</span>
                {wifi.can.manage && n.own && (
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={act.isPending} onClick={() => run('forget', { ssid: n.ssid })}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    {t('Forget')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NetworkItem({ row, tapped, canConnect, busy, onTap, onConnect }: {
  row: NetworkRow;
  tapped: boolean;
  canConnect: boolean;
  busy: boolean;
  onTap: () => void;
  onConnect: (pass: string | null) => void;
}) {
  const { t } = useT();
  const needs = connectNeeds(row);
  return (
    <li>
      <button
        type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left disabled:cursor-default"
        disabled={needs === 'none' || !canConnect} onClick={onTap} aria-expanded={tapped}
      >
        <SignalIcon rssi={row.rssi} />
        <span className="min-w-0 flex-1 truncate font-medium">{row.ssid}</span>
        {!row.open && <Lock className="h-4 w-4 shrink-0 text-muted" aria-label={t('Needs a password')} />}
        {row.connected
          ? <span className="text-xs font-medium text-emerald-700">{t('Connected')}</span>
          : row.saved && <span className="text-xs text-muted">{t('Saved')}</span>}
      </button>
      {tapped && needs !== 'none' && (
        <div className="space-y-2 px-3 pb-3">
          {needs === 'password'
            ? <PasswordConnect busy={busy} onConnect={(pass) => onConnect(pass)} onCancel={onTap} />
            : (
              <>
                {row.open && !row.saved && <p className="text-xs text-amber-800">{t('An open network: anyone nearby can join it.')}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => onConnect(null)}>{t('Connect')}</Button>
                  <Button size="sm" variant="ghost" onClick={onTap}>{t('Cancel')}</Button>
                </div>
              </>
            )}
        </div>
      )}
    </li>
  );
}

function PasswordConnect({ busy, onConnect, onCancel, label }: {
  busy: boolean;
  onConnect: (pass: string) => void;
  onCancel?: () => void;
  label?: string;
}) {
  const { t } = useT();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Input
          aria-label={label ?? t('Password')} type={show ? 'text' : 'password'} value={pass} autoComplete="new-password"
          placeholder={label ?? t('Password')} onChange={(e) => setPass(e.target.value)}
        />
        <button
          type="button" aria-label={show ? t('Hide password') : t('Show password')}
          className="rounded p-2 text-muted hover:text-foreground" onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !passwordOk(pass)} onClick={() => onConnect(pass)}>{t('Connect')}</Button>
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>}
      </div>
    </div>
  );
}

function AttemptBanner({ attempt, canRetry, busy, onRetry, onPassword }: {
  attempt: NonNullable<ReturnType<typeof attemptView>>;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
  onPassword: (pass: string) => void;
}) {
  const { t } = useT();
  if (attempt.state !== 'failed') {
    return (
      <p className="rounded-md bg-amber-50 p-2 text-amber-800">
        {attempt.state === 'trying'
          ? t('Connecting to {network}… Its readings are kept meanwhile.', { network: attempt.ssid })
          : t('It connects to {network} when it is back online', { network: attempt.ssid })}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-md bg-red-50 p-2 text-red-800">
      <p>
        <span className="font-medium">{t('Could not connect to {network}', { network: attempt.ssid })}</span>
        {' · '}{problemText(t, attempt.problem)}
      </p>
      <p className="text-xs">{t('It went back to a network that works.')}</p>
      {canRetry && (attempt.newPassword
        ? <PasswordConnect busy={busy} onConnect={onPassword} label={t('The right password')} />
        : <Button size="sm" variant="secondary" disabled={busy} onClick={onRetry}>{t('Retry')}</Button>)}
    </div>
  );
}

function AddNetwork({ busy, onAdd, onCancel }: { busy: boolean; onAdd: (ssid: string, pass: string) => void; onCancel: () => void }) {
  const { t } = useT();
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const name = ssid.trim();
  const ok = name.length > 0 && new TextEncoder().encode(name).length <= 32 && (pass === '' || passwordOk(pass));
  return (
    <div className="mt-2 space-y-2 rounded-xl border p-3">
      <p className="text-xs text-muted">{t('For a network it cannot see now: it joins it when it is in range.')}</p>
      <Field label={t('WiFi name')}>
        <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder={t('Exactly as a phone shows it')} />
      </Field>
      <Field label={t('Password')}>
        <Input type="password" value={pass} autoComplete="new-password" onChange={(e) => setPass(e.target.value)} placeholder={t('Empty for an open network')} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !ok} onClick={() => onAdd(name, pass)}>{t('Save')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </div>
  );
}
