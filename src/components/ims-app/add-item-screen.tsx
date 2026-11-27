'use client';

import { CheckCircle2, CloudOff, Plus, Search, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { FieldPhoto, type ReadyPhoto } from '@/components/ims-app/field-photo';
import { useImsHref } from '@/components/ims-app/ims-links';
import { waitingWords } from '@/components/ims-app/queue-bar';
import { useImsQueue } from '@/components/ims-app/queue-context';
import { useImsSetup } from '@/components/ims-app/use-ims-setup';
import { AppLink } from '@/components/ui/app-link';
import { useLocale, useT } from '@/lib/i18n/context';
import { newClientId } from '@/lib/ims/client-id';
import { detailsOf, fieldProblems, itemFields, phoneFields, textMax, type ApiField } from '@/lib/ims/fields';
import { keepStockInPhotos, type PendingPhoto } from '@/lib/ims/photo-queue';
import { uploadReadyPhoto } from '@/lib/ims/photo-upload';
import { scanStatus } from '@/lib/ims/queue';
import { addItemMovement, itemCode, matchProducts, parseQtyInput, refusalWords, stockableProducts } from '@/lib/ims/stock-in';
import { qtyText, specFieldsOf, specsText } from '@/lib/ims/stock-view';
import type { ApiProduct } from '@/lib/ims/types';
import { cn } from '@/lib/utils';

type Step = 'item' | 'details' | 'done';
type Note = { tone: 'error' | 'info'; text: string } | null;
/** The add's own optional photo when the item has no photo field (key of no field). */
const OWN_PHOTO = '';

const card = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100';
const input = 'h-12 w-full rounded-xl bg-white px-3 text-base text-foreground ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-primary';
const bigButton = 'h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-white disabled:opacity-50';

/**
 * Add item: stock added with no QR (Ashutosh, 2026-11-27: "i dont want qr right now, just adding a item"). Pick the
 * item (each has its own fields, set by our staff), fill in its fields and the quantity (empty: not counted yet,
 * shown as "—"), then Add to stock. The add is kept on the phone first and sent from there, so it is never lost
 * to weak Wi-Fi, and it names its own record (itemCode), so it and its photos work with no connection: the last
 * screen says whether it went through, waits, or was refused.
 */
export function AddItemScreen({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const locale = useLocale();
  const imsLink = useImsHref();
  const setup = useImsSetup(factoryId);
  const { queue, add, answers, stop, addPhoto, removePhoto } = useImsQueue();

  const [step, setStep] = useState<Step>('item');
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [specs, setSpecs] = useState<Record<string, string | null>>({});
  const [qty, setQty] = useState('');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, ReadyPhoto>>({});
  const [showProblems, setShowProblems] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [added, setAdded] = useState<{ clientId: string; name: string; text: string } | null>(null);

  const photosReady = Boolean(setup.data?.photos_ready);
  const products = useMemo(() => stockableProducts(setup.data?.products ?? []), [setup.data]);
  // what adding this item asks, in its order (photo fields only once the factory's photos are set up)
  const asked = useMemo(
    () => phoneFields(itemFields(product)).filter((f) => f.type !== 'photo' || photosReady),
    [product, photosReady],
  );
  const hasPhotoField = asked.some((f) => f.type === 'photo');

  const say = useCallback((tone: 'error' | 'info', text: string) => setNote({ tone, text }), []);

  const pickItem = (p: ApiProduct) => {
    setProduct(p);
    setSpecs({});
    setTyped({});
    setPhotos({});
    setShowProblems(false);
    setNote(null);
    setStep('details');
  };

  const parsedQty = parseQtyInput(qty);
  const problems = fieldProblems(asked, { specs, typed, photos: new Set(Object.keys(photos)) });
  const problemText = (f: ApiField): string | null => {
    if (!showProblems || !problems[f.key]) return null;
    if (problems[f.key] === 'bad_number') return t('Type a number like 40 or 12.5.');
    if (problems[f.key] === 'too_long') return t('Up to {count} characters.', { count: textMax(f) });
    return t('This is needed.');
  };

  /**
   * The add's photos kept on the phone BEFORE the add is queued, so it never goes out without the photos it was
   * taken with (a required one most of all). Without IndexedDB (a private window) they are sent at once instead.
   * Any that cannot be kept or sent: those already kept are taken back, nothing is queued, and the person is told.
   * The photos name the add (its client_id) and its record: the server counts them only once that add is taken.
   */
  const keepPhotos = async (code: string, addId: string) => {
    const pendings: PendingPhoto[] = Object.entries(photos).map(([key, ready]) => ({
      id: newClientId(), factoryId, pallet: code, field: key === OWN_PHOTO ? null : key, stockIn: addId, source: ready.source,
      takenAt: ready.takenAt.toISOString(), takenAtSource: ready.takenAtSource, full: ready.full, thumb: ready.thumb,
      addedAt: new Date().toISOString(),
    }));
    const kept = await keepStockInPhotos(pendings, {
      keep: addPhoto, upload: (p) => uploadReadyPhoto(factoryId, p), remove: removePhoto,
    });
    if (kept.ok) return { ok: true as const, count: pendings.length, keptIds: kept.keptIds };
    return {
      ok: false as const,
      text: kept.reason === 'not_sent'
        ? t('The photo could not be sent. Check the connection and try again.')
        : t('This phone could not keep the photo. Free some space on the phone and try again.'),
    };
  };

  const submit = async () => {
    if (!product || saving) return;
    if (!parsedQty.ok) return say('error', t('Type a number like 40 or 12.5, or leave it empty.'));
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return say('error', t('Fill in the details marked in red.'));
    }
    setSaving(true);
    try {
      const clientId = newClientId();
      const code = itemCode(clientId);
      if (!code) return say('error', t('This phone could not keep the scan. Free some space on the phone and try again.'));
      const kept = await keepPhotos(code, clientId);
      if (!kept.ok) return say('error', kept.text);
      const details = detailsOf(asked, typed);
      const movement = addItemMovement({ product, qty: parsedQty.qty, specs, details }, clientId);
      if (!add(movement)) {
        // no add for the photos to show on: take them back too
        kept.keptIds.forEach(removePhoto);
        return say('error', t('This phone could not keep the scan. Free some space on the phone and try again.'));
      }
      const chosen = specsText(Object.fromEntries(Object.entries(specs).filter(([, v]) => v)) as Record<string, string>, specFieldsOf(asked.filter((f) => f.type === 'choice')));
      setAdded({ clientId, name: product.name, text: [`${qtyText(parsedQty.qty, locale)} ${product.unit}`, chosen].filter(Boolean).join(' · ') });
      setPhotoCount(kept.count);
      setNote(null);
      setStep('done');
    } finally {
      setSaving(false);
    }
  };

  /** The next one of the same item: its form again, empty (a run of adds is usually the same item). */
  const another = () => {
    setQty('');
    setTyped({});
    setPhotos({});
    setShowProblems(false);
    setNote(null);
    setStep(product ? 'details' : 'item');
  };

  // the server's answer is kept: clearing a refused add from the bar never turns this card into "added"
  const result = added ? scanStatus(added.clientId, queue, answers) : null;
  const status = result?.kind ?? 'waiting';

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">{t('Add item')}</h1>

      {step === 'details' && product && (
        <section className={cn(card, 'flex items-center gap-3 px-4 py-2.5')} aria-label={t('Item')}>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{t('Item')}</p>
            <p className="truncate text-base font-semibold text-foreground">{product.name}</p>
          </div>
          <button type="button" onClick={() => { setNote(null); setStep('item'); }} className="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-primary hover:bg-slate-50">{t('Change')}</button>
        </section>
      )}

      {note && (
        <p role="alert" className={cn('flex items-start gap-2 rounded-2xl p-3 text-sm', note.tone === 'error' ? 'bg-red-50 text-red-900 ring-1 ring-red-200' : 'bg-sky-50 text-sky-900 ring-1 ring-sky-200')}>
          {note.tone === 'error' ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          {note.text}
        </p>
      )}

      {step === 'item' && (
        <ItemStep products={products} loading={setup.loading} failed={!setup.data && Boolean(setup.error)} onRetry={() => void setup.refetch()} onPick={pickItem} />
      )}

      {step === 'details' && product && (
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <section className={card}>
            <label htmlFor="ims-qty" className="block text-base font-semibold text-foreground">{t('Quantity ({unit})', { unit: product.unit })}</label>
            <input
              id="ims-qty"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(',', '.'))}
              placeholder="—"
              aria-invalid={!parsedQty.ok}
              className={cn(input, 'mt-2 text-2xl font-semibold', !parsedQty.ok && 'ring-2 ring-red-400')}
            />
            {parsedQty.ok ? (
              <p className="mt-1 text-sm text-muted">{t('Leave it empty if it is not counted yet. It shows as — until someone counts it.')}</p>
            ) : (
              <p className="mt-1 text-sm font-medium text-red-700">{t('Type a number like 40 or 12.5, or leave it empty.')}</p>
            )}
          </section>

          {asked.length > 0 && (
            <section className={cn(card, 'space-y-3')} aria-label={t('Details')}>
              <p className="text-base font-semibold text-foreground">{t('Details')}</p>
              {asked.map((f) => (
                <AskedField
                  key={f.key}
                  field={f}
                  choice={specs[f.key] ?? ''}
                  onChoice={(v) => setSpecs((x) => ({ ...x, [f.key]: v || null }))}
                  typed={typed[f.key] ?? ''}
                  onTyped={(v) => setTyped((x) => ({ ...x, [f.key]: v }))}
                  photo={photos[f.key] ?? null}
                  onPhoto={(p) => setPhotos((x) => withPhoto(x, f.key, p))}
                  error={problemText(f)}
                />
              ))}
            </section>
          )}

          {photosReady && !hasPhotoField && (
            <section className={card}>
              <FieldPhoto
                id="ims-own-photo"
                label={t('Photo (optional)')}
                required={false}
                value={photos[OWN_PHOTO] ?? null}
                onChange={(p) => setPhotos((x) => withPhoto(x, OWN_PHOTO, p))}
                error={null}
              />
            </section>
          )}

          <button type="submit" disabled={!parsedQty.ok || saving} className={bigButton}>{saving ? t('Saving…') : t('Add to stock')}</button>
        </form>
      )}

      {step === 'done' && added && (
        <div className="space-y-3">
          <section
            aria-live="polite"
            className={cn(
              'rounded-2xl p-4 ring-1',
              status === 'added' ? 'bg-emerald-50 ring-emerald-200' : status === 'refused' ? 'bg-red-50 ring-red-200' : 'bg-amber-50 ring-amber-200',
            )}
          >
            <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
              {status === 'added' ? <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden /> : status === 'refused' ? <TriangleAlert className="h-6 w-6 text-red-700" aria-hidden /> : <CloudOff className="h-6 w-6 text-amber-700" aria-hidden />}
              {status === 'added' ? t('Added to stock') : status === 'refused' ? t('Not added') : status === 'waiting' ? t('Saved on this phone') : t('Sent')}
            </p>
            <p className="mt-1 text-base font-medium text-foreground">{added.name}</p>
            <p className="text-sm text-foreground">{added.text}</p>
            <p className="mt-1 text-sm text-muted">
              {result?.kind === 'added'
                ? t('It is in Available stock now.')
                : result?.kind === 'refused'
                  ? refusalWords(result.refusal, t)
                  : result?.kind === 'unknown'
                    ? t('Check Available stock to see it.')
                    : waitingWords(stop, t)}
            </p>
            {photoCount > 0 && (
              <p className="mt-1 text-sm text-muted">
                {tn(photoCount, 'The photo is on this phone and is sent by itself.', '{count} photos are on this phone and are sent by themselves.', { count: photoCount })}
              </p>
            )}
          </section>
          <button type="button" onClick={another} className={cn(bigButton, 'flex items-center justify-center gap-2')}>
            <Plus className="h-5 w-5" aria-hidden />{t('Add another')}
          </button>
          <AppLink href={imsLink('/stock')} className="flex h-12 items-center justify-center rounded-2xl font-medium text-primary ring-1 ring-slate-300">{t('See available stock')}</AppLink>
          {product && (
            <p className="text-center text-xs text-muted">{t('The next one keeps {item}. Change it if needed.', { item: product.name })}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ItemStep({ products, loading, failed, onRetry, onPick }: {
  products: ApiProduct[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onPick: (p: ApiProduct) => void;
}) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const shown = matchProducts(products, search);

  if (loading) return <div className={cn(card, 'h-40 animate-pulse')} aria-busy="true" />;
  if (failed) {
    return (
      <div className={cn(card, 'text-center')}>
        <p className="text-base text-foreground">{t('Could not load the items. Check the connection and try again.')}</p>
        <button type="button" onClick={onRetry} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">{t('Try again')}</button>
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className={cn(card, 'text-center')}>
        <p className="text-base text-foreground">{t('No items are set up yet. Ask FloorBeat to add them.')}</p>
        <button type="button" onClick={onRetry} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">{t('Try again')}</button>
      </div>
    );
  }
  return (
    <section className="space-y-3">
      <p className="text-lg font-semibold text-foreground">{t('Which item?')}</p>
      {products.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="ims-item-search" className="sr-only">{t('Search items')}</label>
          <input id="ims-item-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search items')} autoComplete="off" className={cn(input, 'pl-10')} />
        </div>
      )}
      {shown.length === 0 ? (
        <p className={cn(card, 'text-center text-base text-muted')}>{t('No item matches.')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          {shown.map((p) => (
            <li key={p.product_id}>
              <button type="button" onClick={() => onPick(p)} className="flex min-h-16 w-full flex-col justify-center px-4 py-2 text-left active:bg-slate-50">
                <span className="font-semibold text-foreground">{p.name}</span>
                <span className="text-sm text-muted">{[p.sku, p.unit].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function withPhoto(photos: Record<string, ReadyPhoto>, key: string, photo: ReadyPhoto | null): Record<string, ReadyPhoto> {
  const next = { ...photos };
  if (photo) next[key] = photo;
  else delete next[key];
  return next;
}

/** One field adding the item asks for: a pick-list, a line of text, a number or a photo. */
function AskedField({ field, choice, onChoice, typed, onTyped, photo, onPhoto, error }: {
  field: ApiField;
  choice: string;
  onChoice: (value: string) => void;
  typed: string;
  onTyped: (value: string) => void;
  photo: ReadyPhoto | null;
  onPhoto: (photo: ReadyPhoto | null) => void;
  error: string | null;
}) {
  const id = `ims-field-${field.key}`;
  const label = `${field.label}${field.type === 'number' && field.unit ? ` (${field.unit})` : ''}${field.required ? ' *' : ''}`;
  if (field.type === 'photo') {
    return <FieldPhoto id={id} label={field.label} required={field.required} allowLibrary={field.allow_library !== false} value={photo} onChange={onPhoto} error={error} />;
  }
  const bad = error ? 'ring-2 ring-red-400' : '';
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-muted">{label}</label>
      {field.type === 'choice' ? (
        <select id={id} value={choice} onChange={(e) => onChoice(e.target.value)} aria-invalid={Boolean(error)} className={cn(input, 'mt-1', bad)}>
          <option value="">—</option>
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          id={id}
          value={typed}
          onChange={(e) => onTyped(e.target.value)}
          inputMode={field.type === 'number' ? 'decimal' : 'text'}
          maxLength={field.type === 'text' ? textMax(field) : 20}
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={Boolean(error)}
          className={cn(input, 'mt-1', bad)}
        />
      )}
      {error && <p className="mt-1 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
