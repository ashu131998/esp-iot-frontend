'use client';

import { CloudOff, RefreshCw, TriangleAlert, X } from 'lucide-react';

import { useImsQueue } from '@/components/ims-app/queue-context';
import { keptImsSetup } from '@/components/ims-app/use-ims-setup';
import { useLocale, useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import type { Queued } from '@/lib/ims/queue';
import type { SendStop } from '@/lib/ims/sender';
import { isItemCode, refusalWords } from '@/lib/ims/stock-in';
import { qtyText } from '@/lib/ims/stock-view';

/**
 * A queued scan in a few words: an item added with no QR by its item and quantity ("Fabric roll · 40"), a label's
 * scan by its codes ("PL-000012 → R03-C05"). `nameOf`: an item's name from its id (null when not known).
 */
export function scanLine(q: Queued, nameOf: (productId: string) => string | null = () => null, locale: Locale = 'en'): string {
  const m = q.movement;
  if (m.type === 'in' && isItemCode(m.pallet)) {
    const name = (m.product_id && nameOf(m.product_id)) || m.product_id || '';
    return `${name} · ${qtyText(m.qty ?? null, locale)}`;
  }
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
  const locale = useLocale();
  const { factoryId, queue, waiting, rejected, sending, stop, stale, send, remove, dismissStale, photosWaiting, photosRefused, removePhoto } = useImsQueue();
  if (waiting === 0 && rejected === 0 && stale.length === 0 && photosWaiting === 0 && photosRefused.length === 0) return null;
  const refused = queue.filter((q) => q.rejected);
  // the items' names from the phone's saved copy (no network call: this bar is on every page)
  const names = new Map((keptImsSetup(factoryId)?.products ?? []).map((p) => [p.product_id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? null;
  /** A refused photo by the add it was taken with, when that is still on the phone; else its record's code. */
  const photoLine = (p: { pallet: string; stockIn?: string | null }) => {
    const owner = p.stockIn ? queue.find((q) => q.movement.client_id === p.stockIn) : undefined;
    return owner ? scanLine(owner, nameOf, locale) : p.pallet;
  };

  return (
    <div className="mb-3 space-y-2">
      {(waiting > 0 || photosWaiting > 0) && (
        <section className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200" aria-live="polite">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-medium text-amber-900">
              {waiting > 0 && <span className="block">{tn(waiting, '{count} scan waiting to send', '{count} scans waiting to send', { count: waiting })}</span>}
              {photosWaiting > 0 && <span className="block">{tn(photosWaiting, '{count} photo waiting to send', '{count} photos waiting to send', { count: photosWaiting })}</span>}
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
                    <p className="text-sm font-medium text-foreground">{scanLine(q, nameOf, locale)}</p>
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

      {photosRefused.length > 0 && (
        <section className="rounded-2xl bg-red-50 p-3 ring-1 ring-red-200" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            {tn(photosRefused.length, '{count} photo was not saved', '{count} photos were not saved', { count: photosRefused.length })}
          </p>
          <ul className="mt-2 space-y-2">
            {photosRefused.map((p) => (
              <li key={p.id} className="flex items-start gap-2 rounded-xl bg-white p-2 ring-1 ring-red-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{photoLine(p)}</p>
                  <p className="text-sm text-red-900">{p.refused}</p>
                </div>
                <button type="button" onClick={() => removePhoto(p.id)} aria-label={t('Remove')} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-slate-100">
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </li>
            ))}
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
