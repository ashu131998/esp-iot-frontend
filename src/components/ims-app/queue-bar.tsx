'use client';

import { CloudOff, RefreshCw, TriangleAlert, X } from 'lucide-react';

import { useImsQueue } from '@/components/ims-app/queue-context';
import { useT } from '@/lib/i18n/context';
import type { Queued } from '@/lib/ims/queue';
import type { SendStop } from '@/lib/ims/sender';
import { refusalWords } from '@/lib/ims/stock-in';

/** A queued scan in a few words: "PL-000012 → R03-C05". */
export function scanLine(q: Queued): string {
  const m = q.movement;
  return m.to ? `${m.pallet} → ${m.to}` : m.pallet;
}

/** Why scans still wait, in a line: the connection, unless the last try said something else. */
export function waitingWords(stop: SendStop | null, t: (key: string) => string): string {
  switch (stop) {
    case 'signed_out':
      return t('You are signed out. Sign in again to send them. They stay on this phone.');
    case 'off':
      return t('FloorBeat IMS is not switched on for this factory. Ask FloorBeat to switch it on.');
    case 'denied':
      return t('This account cannot add stock. Sign in with an account of this factory.');
    case 'refused':
      return t('FloorBeat could not take these scans. They stay on this phone. Tell FloorBeat.');
    default:
      return t('They stay on this phone and are sent by themselves when the connection is back.');
  }
}

/**
 * What waits on the phone, at the top of every screen: scans not sent yet (and why, when it is not just
 * the connection), and scans the server refused, each with its reason, kept until the person has seen
 * it. Nothing shows when everything has gone through.
 */
export function ImsQueueBar() {
  const { t, tn } = useT();
  const { queue, waiting, rejected, sending, stop, stale, send, remove, dismissStale } = useImsQueue();
  if (waiting === 0 && rejected === 0 && stale.length === 0) return null;
  const refused = queue.filter((q) => q.rejected);

  return (
    <div className="mb-3 space-y-2">
      {waiting > 0 && (
        <section className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200" aria-live="polite">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-medium text-amber-900">
              {tn(waiting, '{count} scan waiting to send', '{count} scans waiting to send', { count: waiting })}
            </p>
            {stop === 'signed_out' ? (
              <button type="button" onClick={() => window.location.reload()} className="h-10 shrink-0 rounded-xl bg-white px-3 text-sm font-medium text-amber-900 ring-1 ring-amber-300">
                {t('Sign in')}
              </button>
            ) : (
              <button type="button" onClick={send} disabled={sending} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-medium text-amber-900 ring-1 ring-amber-300 disabled:opacity-60">
                <RefreshCw className={sending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
                {sending ? t('Sending…') : t('Send now')}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-amber-900">{waitingWords(stop, t)}</p>
        </section>
      )}

      {rejected > 0 && (
        <section className="rounded-2xl bg-red-50 p-3 ring-1 ring-red-200" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            {tn(rejected, '{count} scan was not saved', '{count} scans were not saved', { count: rejected })}
          </p>
          <ul className="mt-2 space-y-2">
            {refused.map((q) => {
              return (
                <li key={q.movement.client_id} className="flex items-start gap-2 rounded-xl bg-white p-2 ring-1 ring-red-100">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium text-foreground">{scanLine(q)}</p>
                    <p className="text-sm text-red-900">{refusalWords(q.rejected, t)}</p>
                  </div>
                  <button type="button" onClick={() => remove(q.movement.client_id)} aria-label={t('Remove')} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-slate-100">
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {stale.length > 0 && (
        <section className="flex items-start gap-2 rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-200">
          <p className="min-w-0 flex-1 text-sm text-sky-900">
            {t('Saved, but a newer scan had changed this pallet already. Count it if in doubt.')}
          </p>
          <button type="button" onClick={dismissStale} aria-label={t('Close')} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sky-900 hover:bg-sky-100">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </section>
      )}
    </div>
  );
}
