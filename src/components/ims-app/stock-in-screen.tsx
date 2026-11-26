'use client';

import { Camera, CheckCircle2, ChevronDown, CloudOff, Search, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { FieldPhoto, type ReadyPhoto } from '@/components/ims-app/field-photo';
import { QrScanner } from '@/components/ims-app/qr-scanner';
import { waitingWords } from '@/components/ims-app/queue-bar';
import { useImsQueue } from '@/components/ims-app/queue-context';
import { useImsSetup } from '@/components/ims-app/use-ims-setup';
import { AppLink } from '@/components/ui/app-link';
import { useLocale, useT } from '@/lib/i18n/context';
import { ImsApiError, imsApi, isImsOff } from '@/lib/ims/api';
import { newClientId } from '@/lib/ims/client-id';
import { detailsOf, fieldProblems, phoneFields, stockInFields, textMax, type ApiField } from '@/lib/ims/fields';
import { keepStockInPhotos, type PendingPhoto } from '@/lib/ims/photo-queue';
import { uploadReadyPhoto } from '@/lib/ims/photo-upload';
import { scanStatus } from '@/lib/ims/queue';
import {
  checkLocation, latestProducedOn, matchProducts, offlinePalletScan, palletScanOutcome, parseQtyInput, producedOnOk,
  readCode, refusalWords, stockableProducts, stockInMovement, type PalletScan,
} from '@/lib/ims/stock-in';
import { qtyText, specFieldsOf, specsText } from '@/lib/ims/stock-view';
import type { ApiProduct } from '@/lib/ims/types';
import { cn } from '@/lib/utils';

type Step = 'pallet' | 'product' | 'location' | 'details' | 'done';
type Note = { tone: 'error' | 'info'; text: string } | null;
/** Add stock's own optional photo when the factory has no photo field (key of no field). */
const OWN_PHOTO = '';

const card = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100';
const input = 'h-12 w-full rounded-xl bg-white px-3 text-base text-foreground ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-primary';
const bigButton = 'h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-white disabled:opacity-50';

/**
 * Stock in: a new pallet into stock. Scan its label (a label of ours not used yet), pick the product
 * (its specs filled in, changeable), scan the location, give the quantity (empty: not counted yet,
 * shown as "—"), then Add stock. The scan is kept on the phone first and sent from there, so it is
 * never lost to weak Wi-Fi: the last screen says whether it went through, waits, or was refused.
 * Every code can be typed instead of scanned. A photo can be added when the factory's photos are set up.
 */
export function StockInScreen({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const locale = useLocale();
  const setup = useImsSetup(factoryId);
  const { queue, add, answers, stop, addPhoto, removePhoto } = useImsQueue();

  const [step, setStep] = useState<Step>('pallet');
  const [pallet, setPallet] = useState<string | null>(null);
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, string | null>>({});
  const [qty, setQty] = useState('');
  const [batch, setBatch] = useState('');
  const [producedOn, setProducedOn] = useState('');
  const [more, setMore] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, ReadyPhoto>>({});
  const [showProblems, setShowProblems] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [checking, setChecking] = useState(false);
  const [added, setAdded] = useState<{ clientId: string; text: string } | null>(null);
  const checkingRef = useRef(false);

  const fields = useMemo(() => specFieldsOf(setup.data?.spec_fields), [setup.data]);
  const photosReady = Boolean(setup.data?.photos_ready);
  // what Add stock asks, in the factory's order (photo fields only once the factory's photos are set up)
  const asked = useMemo(
    () => phoneFields(stockInFields(setup.data)).filter((f) => f.type !== 'photo' || photosReady),
    [setup.data, photosReady],
  );
  const hasPhotoField = asked.some((f) => f.type === 'photo');
  const products = useMemo(() => stockableProducts(setup.data?.products ?? []), [setup.data]);
  const locations = useMemo(() => setup.data?.locations ?? [], [setup.data]);

  const say = useCallback((tone: 'error' | 'info', text: string) => setNote({ tone, text }), []);

  const palletMessage = useCallback((outcome: PalletScan): string | null => {
    switch (outcome.kind) {
      case 'in_stock':
        return outcome.location
          ? t('This pallet is already in stock at {location}. Use Move instead.', { location: outcome.location })
          : t('This pallet is already in stock. Use Move instead.');
      case 'closed':
        return t('This pallet label was used before and is closed. Use a new label.');
      case 'location':
        return t('This is a location\'s code. Scan the pallet label first.');
      case 'unknown':
        return t('This is not one of our pallet labels. Use a label from the sheet.');
      default:
        return null;
    }
  }, [t]);

  const onPallet = useCallback(async (text: string) => {
    const code = readCode(text);
    if (!code) return say('error', t('This QR code is not one of ours.'));
    if (checkingRef.current) return;
    if (queue.some((q) => q.movement.type === 'in' && q.movement.pallet === code && !q.rejected)) {
      return say('error', t('This pallet was added already. It is waiting to be sent.'));
    }
    checkingRef.current = true;
    setChecking(true);
    let outcome: PalletScan;
    let offline: 'connection' | 'server' | null = null;
    try {
      outcome = palletScanOutcome(await imsApi.scan(factoryId, code));
    } catch (error) {
      if (error instanceof ImsApiError && error.status === 422) outcome = { kind: 'unknown' };
      else if (error instanceof ImsApiError && error.status === 401) {
        return say('error', t('You are signed out. Sign in again to add stock.'));
      } else if (isImsOff(error)) {
        return say('error', t('FloorBeat IMS is not switched on for this factory. Ask FloorBeat to switch it on.'));
      } else if (error instanceof ImsApiError && error.status >= 400 && error.status < 500) {
        // a disabled account, another factory's, a factory that is gone: asking again changes nothing
        return say('error', t('This account cannot add stock. Sign in with an account of this factory.'));
      } else {
        // no connection, or the server failing: a label in our form goes ahead and is checked when it is sent
        outcome = offlinePalletScan(code, locations);
        offline = error instanceof ImsApiError ? 'server' : 'connection';
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
    const problem = palletMessage(outcome);
    if (problem) return say('error', problem);
    setPallet(code);
    setNote(offline === 'connection'
      ? { tone: 'info', text: t('No connection: this label is checked when the scan is sent.') }
      : offline === 'server'
        ? { tone: 'info', text: t('FloorBeat could not check this label now. It is checked when the scan is sent.') }
        : null);
    setStep(product ? (location ? 'details' : 'location') : 'product');
  }, [factoryId, locations, location, palletMessage, product, queue, say, t]);

  const onLocation = useCallback((text: string) => {
    const code = readCode(text);
    if (!code) return say('error', t('This QR code is not one of ours.'));
    if (setup.data) {
      const check = checkLocation(code, locations);
      if (check === 'pallet_label') return say('error', t('This is a pallet label. Scan the location\'s code.'));
      if (check === 'not_in_use') return say('error', t('This location is not in use. Use another one.'));
      if (check === 'unknown') return say('error', t('This location is not in the system.'));
    }
    setLocation(code);
    setNote(null);
    setStep('details');
  }, [locations, say, setup.data, t]);

  const pickProduct = (p: ApiProduct) => {
    setProduct(p);
    setSpecs(Object.fromEntries(asked.filter((f) => f.type === 'choice').map((f) => [f.key, p.specs[f.key] ?? null])));
    setNote(null);
    setStep(location ? 'details' : 'location');
  };

  const parsedQty = parseQtyInput(qty);
  const dateOk = producedOnOk(producedOn);
  const problems = fieldProblems(asked, { specs, typed, photos: new Set(Object.keys(photos)) });
  const problemText = (f: ApiField): string | null => {
    if (!showProblems || !problems[f.key]) return null;
    if (problems[f.key] === 'bad_number') return t('Type a number like 40 or 12.5.');
    if (problems[f.key] === 'too_long') return t('Up to {count} characters.', { count: textMax(f) });
    return t('This is needed.');
  };

  /**
   * The stock-in's photos kept on the phone BEFORE the scan is queued, so a stock-in never goes out without
   * the photos it was taken with (a required one most of all). Without IndexedDB (a private window) they are
   * sent at once instead. Any that cannot be kept or sent: those already kept are taken back, nothing is
   * queued, and the person is told. The photos name the stock-in (its client_id): the server counts them only
   * once that stock-in is taken for this pallet.
   */
  const keepPhotos = async (palletCode: string, stockIn: string) => {
    const pendings: PendingPhoto[] = Object.entries(photos).map(([key, ready]) => ({
      id: newClientId(), factoryId, pallet: palletCode, field: key === OWN_PHOTO ? null : key, stockIn, source: ready.source,
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
    if (!pallet || !product || !location || saving) return;
    if (!parsedQty.ok) return say('error', t('Type a number like 40 or 12.5, or leave it empty.'));
    if (!dateOk) return say('error', t('The production date cannot be after tomorrow.'));
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return say('error', t('Fill in the details marked in red.'));
    }
    setSaving(true);
    try {
      const clientId = newClientId();
      const kept = await keepPhotos(pallet, clientId);
      if (!kept.ok) return say('error', kept.text);
      const details = detailsOf(asked, typed);
      const movement = stockInMovement({ pallet, product, location, qty: parsedQty.qty, specs, batch, producedOn, details }, clientId);
      if (!add(movement)) {
        // no stock-in for the photos to show on: take them back too
        kept.keptIds.forEach(removePhoto);
        return say('error', t('This phone could not keep the scan. Free some space on the phone and try again.'));
      }
      const amount = `${qtyText(parsedQty.qty, locale)} ${product.unit}`;
      setAdded({ clientId, text: `${pallet} · ${product.name} · ${amount} · ${location}` });
      setPhotoCount(kept.count);
      setNote(null);
      setStep('done');
    } finally {
      setSaving(false);
    }
  };

  const nextPallet = () => {
    setPallet(null);
    setLocation(null);
    setQty('');
    setBatch('');
    setProducedOn('');
    setTyped({});
    setPhotos({});
    setShowProblems(false);
    setMore(false);
    setNote(null);
    // the product and its specs stay: a run of pallets is usually the same product
    setStep('pallet');
  };

  // the server's answer is kept: clearing a refused scan from the bar never turns this card into "added"
  const result = added ? scanStatus(added.clientId, queue, answers) : null;
  const status = result?.kind ?? 'waiting';

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">{t('Stock in')}</h1>

      {step !== 'pallet' && step !== 'done' && (
        <section className={cn(card, 'divide-y divide-slate-100 p-0')} aria-label={t('This pallet')}>
          <Picked label={t('Pallet')} value={pallet} onChange={() => { setNote(null); setStep('pallet'); }} changeText={t('Change')} mono />
          {(step !== 'product' || product) && (
            <Picked label={t('Product')} value={product ? product.name : null} onChange={() => { setNote(null); setStep('product'); }} changeText={t('Change')} />
          )}
          {location && step === 'details' && (
            <Picked label={t('Location')} value={location} onChange={() => { setNote(null); setStep('location'); }} changeText={t('Change')} mono />
          )}
        </section>
      )}

      {note && (
        <p role="alert" className={cn('flex items-start gap-2 rounded-2xl p-3 text-sm', note.tone === 'error' ? 'bg-red-50 text-red-900 ring-1 ring-red-200' : 'bg-sky-50 text-sky-900 ring-1 ring-sky-200')}>
          {note.tone === 'error' ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          {note.text}
        </p>
      )}

      {step === 'pallet' && (
        <ScanStep
          key="pallet"
          title={t('Scan the pallet label')}
          busy={checking}
          onRead={(text) => void onPallet(text)}
          placeholder="PL-000001"
        />
      )}

      {step === 'location' && (
        <ScanStep key="location" title={t('Scan the location')} onRead={onLocation} placeholder="R01-C01" />
      )}

      {step === 'product' && (
        <ProductStep products={products} loading={setup.loading} failed={!setup.data && Boolean(setup.error)} onRetry={() => void setup.refetch()} onPick={pickProduct} fieldsText={(p) => specsText(p.specs, fields)} />
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
              <p className="mt-1 text-sm text-muted">{t('Leave it empty if the pallet is not counted yet. It shows as — until someone counts it.')}</p>
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

          <section className={card}>
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex w-full items-center justify-between text-base font-semibold text-foreground">
              {t('Batch and production date')}
              <span className="flex items-center gap-1 text-sm font-normal text-muted">{t('Optional')} <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} aria-hidden /></span>
            </button>
            {more && (
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="ims-batch" className="block text-sm text-muted">{t('Batch')}</label>
                  <input id="ims-batch" value={batch} maxLength={40} autoComplete="off" onChange={(e) => setBatch(e.target.value)} className={cn(input, 'mt-1')} />
                </div>
                <div>
                  <label htmlFor="ims-made" className="block text-sm text-muted">{t('Production date')}</label>
                  <input id="ims-made" type="date" value={producedOn} max={latestProducedOn()} onChange={(e) => setProducedOn(e.target.value)} aria-invalid={!dateOk} className={cn(input, 'mt-1', !dateOk && 'ring-2 ring-red-400')} />
                  {!dateOk && <p className="mt-1 text-sm font-medium text-red-700">{t('The production date cannot be after tomorrow.')}</p>}
                </div>
              </div>
            )}
          </section>

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

          <button type="submit" disabled={!parsedQty.ok || !dateOk || saving} className={bigButton}>{saving ? t('Saving…') : t('Add stock')}</button>
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
            <p className="mt-1 font-mono text-sm text-foreground">{added.text}</p>
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
          <button type="button" onClick={nextPallet} className={cn(bigButton, 'flex items-center justify-center gap-2')}>
            <Camera className="h-5 w-5" aria-hidden />{t('Next pallet')}
          </button>
          <AppLink href="/stock" className="flex h-12 items-center justify-center rounded-2xl font-medium text-primary ring-1 ring-slate-300">{t('See available stock')}</AppLink>
          {product && (
            <p className="text-center text-xs text-muted">{t('The next pallet keeps {product}. Change it if needed.', { product: product.name })}</p>
          )}
        </div>
      )}

      {step === 'pallet' && product && (
        <p className="text-center text-xs text-muted">{t('Product: {name}', { name: product.name })}</p>
      )}
    </div>
  );
}

function Picked({ label, value, onChange, changeText, mono = false }: { label: string; value: string | null; onChange: () => void; changeText: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <p className={cn('truncate text-base font-semibold text-foreground', mono && 'font-mono')}>{value ?? '—'}</p>
      </div>
      <button type="button" onClick={onChange} className="h-10 shrink-0 rounded-xl px-3 text-sm font-medium text-primary hover:bg-slate-50">{changeText}</button>
    </div>
  );
}

/** One scan: the camera, and the code typed instead (always there: a torn label, a camera that will not start). */
function ScanStep({ title, onRead, placeholder, busy = false }: { title: string; onRead: (text: string) => void; placeholder: string; busy?: boolean }) {
  const { t } = useT();
  const [typed, setTyped] = useState('');
  return (
    <section className="space-y-3">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <QrScanner onRead={onRead} />
      {busy && <p className="text-center text-sm text-muted" aria-live="polite">{t('Checking…')}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (typed.trim()) onRead(typed); }}
      >
        <label htmlFor="ims-code" className="sr-only">{t('Or type the code')}</label>
        <input
          id="ims-code"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('Or type the code, e.g. {code}', { code: placeholder })}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          className={cn(input, 'font-mono')}
        />
        <button type="submit" disabled={busy || !typed.trim()} className="h-12 shrink-0 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-50">{t('OK')}</button>
      </form>
    </section>
  );
}

function ProductStep({ products, loading, failed, onRetry, onPick, fieldsText }: {
  products: ApiProduct[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onPick: (p: ApiProduct) => void;
  fieldsText: (p: ApiProduct) => string;
}) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const shown = matchProducts(products, search);

  if (loading) return <div className={cn(card, 'h-40 animate-pulse')} aria-busy="true" />;
  if (failed) {
    return (
      <div className={cn(card, 'text-center')}>
        <p className="text-base text-foreground">{t('Could not load the products. Check the connection and try again.')}</p>
        <button type="button" onClick={onRetry} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">{t('Try again')}</button>
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className={cn(card, 'text-center')}>
        <p className="text-base text-foreground">{t('No products are set up yet. Ask your admin to add them.')}</p>
        <button type="button" onClick={onRetry} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">{t('Try again')}</button>
      </div>
    );
  }
  return (
    <section className="space-y-3">
      <p className="text-lg font-semibold text-foreground">{t('Which product is on this pallet?')}</p>
      {products.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="ims-product-search" className="sr-only">{t('Search products')}</label>
          <input id="ims-product-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search products')} autoComplete="off" className={cn(input, 'pl-10')} />
        </div>
      )}
      {shown.length === 0 ? (
        <p className={cn(card, 'text-center text-base text-muted')}>{t('No product matches.')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          {shown.map((p) => {
            const specs = fieldsText(p);
            return (
              <li key={p.product_id}>
                <button type="button" onClick={() => onPick(p)} className="flex min-h-16 w-full flex-col justify-center px-4 py-2 text-left active:bg-slate-50">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <span className="text-sm text-muted">{[p.sku, p.unit, specs].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            );
          })}
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

/** One field Add stock asks for: a pick-list, a line of text, a number or a photo. */
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
