'use client';

import { Camera, CheckCircle2, ChevronDown, CloudOff, ImagePlus, Search, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { QrScanner } from '@/components/ims-app/qr-scanner';
import { useImsQueue } from '@/components/ims-app/queue-context';
import { useImsSetup } from '@/components/ims-app/use-ims-setup';
import { AppLink } from '@/components/ui/app-link';
import { useLocale, useT } from '@/lib/i18n/context';
import { ImsApiError, imsApi, isImsOff } from '@/lib/ims/api';
import { newClientId } from '@/lib/ims/client-id';
import { uploadPalletPhoto } from '@/lib/ims/photo-upload';
import {
  checkLocation, latestProducedOn, matchProducts, offlinePalletScan, palletScanOutcome, parseQtyInput, producedOnOk,
  readCode, refusalWords, stockableProducts, stockInMovement, type PalletScan,
} from '@/lib/ims/stock-in';
import { qtyText, specFieldsOf, specsText } from '@/lib/ims/stock-view';
import type { ApiProduct } from '@/lib/ims/types';
import { cn } from '@/lib/utils';

type Step = 'pallet' | 'product' | 'location' | 'details' | 'done';
type Note = { tone: 'error' | 'info'; text: string } | null;
type PhotoState = 'none' | 'sending' | 'sent' | 'failed';

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
  const { t } = useT();
  const locale = useLocale();
  const setup = useImsSetup(factoryId);
  const { queue, add } = useImsQueue();

  const [step, setStep] = useState<Step>('pallet');
  const [pallet, setPallet] = useState<string | null>(null);
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, string | null>>({});
  const [qty, setQty] = useState('');
  const [batch, setBatch] = useState('');
  const [producedOn, setProducedOn] = useState('');
  const [more, setMore] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoState, setPhotoState] = useState<PhotoState>('none');
  const [note, setNote] = useState<Note>(null);
  const [checking, setChecking] = useState(false);
  const [added, setAdded] = useState<{ clientId: string; text: string } | null>(null);
  const checkingRef = useRef(false);

  const fields = useMemo(() => specFieldsOf(setup.data?.spec_fields), [setup.data]);
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
    let offline = false;
    try {
      outcome = palletScanOutcome(await imsApi.scan(factoryId, code));
    } catch (error) {
      if (error instanceof ImsApiError && error.status === 422) outcome = { kind: 'unknown' };
      else if (error instanceof ImsApiError && error.status === 401) {
        checkingRef.current = false;
        setChecking(false);
        return say('error', t('You are signed out. Sign in again to add stock.'));
      } else if (isImsOff(error)) {
        checkingRef.current = false;
        setChecking(false);
        return say('error', t('FloorBeat IMS is not switched on for this factory. Ask FloorBeat to switch it on.'));
      } else {
        // no connection: a label in our form goes ahead and is checked when it is sent
        outcome = offlinePalletScan(code, locations);
        offline = true;
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
    const problem = palletMessage(outcome);
    if (problem) return say('error', problem);
    setPallet(code);
    setNote(offline ? { tone: 'info', text: t('No connection: this label is checked when the scan is sent.') } : null);
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
    setSpecs(Object.fromEntries(fields.map((f) => [f.key, p.specs[f.key] ?? null])));
    setNote(null);
    setStep(location ? 'details' : 'location');
  };

  const parsedQty = parseQtyInput(qty);
  const dateOk = producedOnOk(producedOn);

  const submit = () => {
    if (!pallet || !product || !location) return;
    if (!parsedQty.ok) return say('error', t('Type a number like 40 or 12.5, or leave it empty.'));
    if (!dateOk) return say('error', t('The production date cannot be after tomorrow.'));
    const clientId = newClientId();
    const movement = stockInMovement({ pallet, product, location, qty: parsedQty.qty, specs, batch, producedOn }, clientId);
    if (!add(movement)) return say('error', t('This phone could not keep the scan. Free some space on the phone and try again.'));
    const amount = `${qtyText(parsedQty.qty, locale)} ${product.unit}`;
    setAdded({ clientId, text: `${pallet} · ${product.name} · ${amount} · ${location}` });
    if (photo && setup.data?.photos_ready) {
      setPhotoState('sending');
      uploadPalletPhoto(factoryId, pallet, photo).then(() => setPhotoState('sent'), () => setPhotoState('failed'));
    } else {
      setPhotoState('none');
    }
    setNote(null);
    setStep('done');
  };

  const nextPallet = () => {
    setPallet(null);
    setLocation(null);
    setQty('');
    setBatch('');
    setProducedOn('');
    setPhoto(null);
    setMore(false);
    setNote(null);
    // the product and its specs stay: a run of pallets is usually the same product
    setStep('pallet');
  };

  const sent = added ? queue.find((q) => q.movement.client_id === added.clientId) : undefined;
  const status: 'added' | 'waiting' | 'refused' = !sent ? 'added' : sent.rejected ? 'refused' : 'waiting';

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
          onSubmit={(e) => { e.preventDefault(); submit(); }}
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

          {fields.length > 0 && (
            <section className={cn(card, 'space-y-3')} aria-label={t('Specs')}>
              <p className="text-base font-semibold text-foreground">{t('Specs')}</p>
              {fields.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`ims-spec-${f.key}`} className="block text-sm text-muted">{f.label}</label>
                  <select
                    id={`ims-spec-${f.key}`}
                    value={specs[f.key] ?? ''}
                    onChange={(e) => setSpecs((s) => ({ ...s, [f.key]: e.target.value || null }))}
                    className={cn(input, 'mt-1')}
                  >
                    <option value="">—</option>
                    {f.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
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

          {setup.data?.photos_ready && (
            <section className={card}>
              {photo ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  <p className="min-w-0 flex-1 text-base text-foreground">{t('Photo added')}</p>
                  <button type="button" onClick={() => setPhoto(null)} className="h-10 rounded-xl px-3 text-sm font-medium text-primary ring-1 ring-slate-300">{t('Remove')}</button>
                </div>
              ) : (
                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl text-base font-medium text-primary ring-1 ring-slate-300">
                  <ImagePlus className="h-5 w-5" aria-hidden />
                  {t('Add a photo (optional)')}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </section>
          )}

          <button type="submit" disabled={!parsedQty.ok || !dateOk} className={bigButton}>{t('Add stock')}</button>
        </form>
      )}

      {step === 'done' && added && (
        <div className="space-y-3">
          <section
            aria-live="polite"
            className={cn(
              'rounded-2xl p-4 ring-1',
              status === 'added' ? 'bg-emerald-50 ring-emerald-200' : status === 'waiting' ? 'bg-amber-50 ring-amber-200' : 'bg-red-50 ring-red-200',
            )}
          >
            <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
              {status === 'added' ? <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden /> : status === 'waiting' ? <CloudOff className="h-6 w-6 text-amber-700" aria-hidden /> : <TriangleAlert className="h-6 w-6 text-red-700" aria-hidden />}
              {status === 'added' ? t('Added to stock') : status === 'waiting' ? t('Saved on this phone') : t('Not added')}
            </p>
            <p className="mt-1 font-mono text-sm text-foreground">{added.text}</p>
            <p className="mt-1 text-sm text-muted">
              {status === 'added'
                ? t('It is in Available stock now.')
                : status === 'waiting'
                  ? t('It is sent by itself when the connection is back.')
                  : refusalWords(sent?.rejected, t)}
            </p>
            {photoState !== 'none' && (
              <p className="mt-1 text-sm text-muted">
                {photoState === 'sending' ? t('Sending the photo…') : photoState === 'sent' ? t('Photo sent.') : t('The photo was not sent. The stock is not affected.')}
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
    return <div className={cn(card, 'text-center text-base text-foreground')}>{t('No products are set up yet. Ask your admin to add them.')}</div>;
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
