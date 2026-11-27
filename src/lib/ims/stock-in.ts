/**
 * Adding stock. Today an item is added with no QR (Ashutosh, 2026-11-27: "i dont want qr right now, just adding a
 * item"): pick the item, fill in its fields and the quantity (components/ims-app/add-item-screen.tsx). The
 * record's name is made here from the add's own id (itemCode), so the add and its photos work with no
 * connection. The QR helpers (readCode, the pallet label and location checks) stay for when labels come back.
 * Pure functions; the server checks all of it again (query-api ims.js parseMovement and applyMovement).
 */
import { todayKey } from '@/lib/format';

import type { Movement } from './queue';
import type { ApiLocation, ApiProduct, ApiScan, Specs } from './types';

/** A code as the server keeps it: letters, digits and dashes, in capitals (query-api ims.js normalizeCode). */
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,39}$/;

/**
 * The code in a QR's text, or null when it is none of ours: the bare code (PL-000012, R03-C05), any
 * case, or a link whose last part is the code (…/p/PL-000012), so a label printed either way scans.
 */
export function readCode(text: string | null | undefined): string | null {
  let value = (text ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      value = url.searchParams.get('code') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';
    } catch {
      return null;
    }
  }
  const code = value.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** Whether a code is in the form of our pallet labels (PL-000001), as printed (query-api palletLabelNumber). */
export function isPalletLabelCode(code: string): boolean {
  const match = /^PL-(\d{6,})$/.exec(code);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 1 && `PL-${String(n).padStart(6, '0')}` === code;
}

/** What the pallet scan means for a stock-in. */
export type PalletScan =
  | { kind: 'new' }
  | { kind: 'in_stock'; location: string | null }
  | { kind: 'closed' }
  | { kind: 'location' }
  | { kind: 'unknown' };

export function palletScanOutcome(scan: ApiScan): PalletScan {
  switch (scan.kind) {
    case 'new_pallet':
      return { kind: 'new' };
    case 'pallet':
      return scan.pallet.status === 'closed' ? { kind: 'closed' } : { kind: 'in_stock', location: scan.pallet.location?.code ?? null };
    case 'location':
      return { kind: 'location' };
    default:
      return { kind: 'unknown' };
  }
}

/**
 * A pallet label read with no connection: it can still be stocked in (the scan waits on the phone and
 * the server checks it when it is sent) if it is in our label form and not one of the factory's locations.
 */
export function offlinePalletScan(code: string, locations: ApiLocation[]): PalletScan {
  if (locations.some((l) => l.code === code)) return { kind: 'location' };
  return isPalletLabelCode(code) ? { kind: 'new' } : { kind: 'unknown' };
}

/** Whether a scanned location is one the pallet can go to: the factory's, and in use. */
export type LocationCheck = 'ok' | 'pallet_label' | 'not_in_use' | 'unknown';

export function checkLocation(code: string, locations: ApiLocation[]): LocationCheck {
  const location = locations.find((l) => l.code === code);
  if (location) return location.active ? 'ok' : 'not_in_use';
  return isPalletLabelCode(code) ? 'pallet_label' : 'unknown';
}

/** The items stock can be added as: those in use, by name. */
export function stockableProducts(products: ApiProduct[]): ApiProduct[] {
  return products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name) || (a.sku ?? '').localeCompare(b.sku ?? ''));
}

/** Items whose name or SKU has the words typed (any order, any case). */
export function matchProducts(products: ApiProduct[], search: string): ApiProduct[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return products;
  return products.filter((p) => {
    const text = `${p.name} ${p.sku ?? ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** A record added with no QR is named IT- and the first 16 hex digits of its add's id (query-api ims.js itemCode). */
export const ITEM_CODE_PREFIX = 'IT-';

/** The name of the record an add makes, from its client_id (a UUID made on the phone); null for anything else. */
export function itemCode(clientId: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) return null;
  return `${ITEM_CODE_PREFIX}${clientId.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

/** Whether a record's code is one an add with no QR made (IT-…), not a pallet label of ours. */
export const isItemCode = (code: string): boolean => /^IT-[0-9A-F]{16}$/.test(code);

export interface AddItemForm {
  product: ApiProduct;
  qty: number | null;
  /** The item's pick-lists' answers (null: none picked). */
  specs: Record<string, string | null>;
  /** The text and number fields' answers (fields.ts detailsOf). */
  details?: Record<string, string | number>;
}

/** An item added (no QR): the scan for the queue, named by its own id, so sending it twice counts once. */
export function addItemMovement(form: AddItemForm, clientId: string, now: Date = new Date()): Movement {
  const code = itemCode(clientId);
  if (!code) throw new Error('An add needs a UUID client_id');
  const specs = Object.fromEntries(Object.entries(form.specs).filter(([, v]) => v)) as Record<string, string>;
  return {
    client_id: clientId,
    type: 'in',
    pallet: code,
    scanned_at: now.toISOString(),
    product_id: form.product.product_id,
    qty: form.qty,
    ...(Object.keys(specs).length > 0 ? { specs } : {}),
    ...(form.details && Object.keys(form.details).length > 0 ? { details: form.details } : {}),
  };
}

export const QTY_MAX = 1e9;

/**
 * The quantity typed: a number above 0 with up to 3 decimals (kg, m), or empty for "not counted yet"
 * (null: the stock shows "—" for it, never 0). Anything else is not a quantity.
 */
export function parseQtyInput(text: string): { ok: true; qty: number | null } | { ok: false } {
  const value = text.trim();
  if (value === '') return { ok: true, qty: null };
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return { ok: false };
  const qty = Number(value);
  if (!(qty > 0) || qty > QTY_MAX) return { ok: false };
  return { ok: true, qty };
}

/** The latest production day a stock-in may give: tomorrow in factory time (the server's own limit). */
export function latestProducedOn(now: Date = new Date()): string {
  return todayKey(new Date(now.getTime() + 86_400_000));
}

/** Whether a production day typed is one the server takes: empty, or a real day no later than tomorrow. */
export function producedOnOk(day: string, now: Date = new Date()): boolean {
  if (day === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day || Number(day.slice(0, 4)) < 1900) return false;
  return day <= latestProducedOn(now);
}

/**
 * What the stock-in says of the pallet's specs: only where they differ from the product's (a choice
 * changed, or one taken away: null). Nothing when they are the product's own.
 */
export function specsChange(productSpecs: Specs, chosen: Record<string, string | null>): Record<string, string | null> | undefined {
  const change: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(chosen)) {
    const v = value || null;
    if (v === (productSpecs[key] ?? null)) continue;
    change[key] = v;
  }
  return Object.keys(change).length > 0 ? change : undefined;
}

export interface StockInForm {
  pallet: string;
  product: ApiProduct;
  location: string;
  qty: number | null;
  specs: Record<string, string | null>;
  batch: string;
  producedOn: string;
  /** The text and number fields' answers (fields.ts detailsOf). */
  details?: Record<string, string | number>;
}

/** The stock-in scan for the queue, with its own id so sending it twice counts once. */
export function stockInMovement(form: StockInForm, clientId: string, now: Date = new Date()): Movement {
  const specs = specsChange(form.product.specs, form.specs);
  const batch = form.batch.replace(/\s+/g, ' ').trim();
  return {
    client_id: clientId,
    type: 'in',
    pallet: form.pallet,
    scanned_at: now.toISOString(),
    product_id: form.product.product_id,
    to: form.location,
    qty: form.qty,
    ...(specs ? { specs } : {}),
    ...(form.details && Object.keys(form.details).length > 0 ? { details: form.details } : {}),
    ...(batch ? { batch } : {}),
    ...(form.producedOn ? { produced_on: form.producedOn } : {}),
  };
}

/**
 * The app's own words for a scan the server refused (query-api ims.js REJECT_REASONS), as English keys
 * for t(); null for a reason the app has no words for (the server's message is shown then). These keys
 * are looked up by value, so ims.test.ts checks each has its Hindi and Gujarati.
 */
export const REFUSAL_TEXT: Record<string, string> = {
  invalid: 'The scan was not complete.',
  no_such_pallet: 'This pallet is not in the system.',
  no_such_location: 'This location is not in the system.',
  no_such_product: 'This item is not in the system, or is no longer used.',
  pallet_closed: 'This pallet label was used before and is closed. Use a new label.',
  already_stocked: 'This pallet is already in stock. Use Move instead.',
  not_our_label: 'This is not one of our pallet labels. Use a label from the sheet.',
};

export function refusalText(reason: string): string | null {
  return Object.prototype.hasOwnProperty.call(REFUSAL_TEXT, reason) ? REFUSAL_TEXT[reason] : null;
}

/** Why the server refused a scan, for the screen: the app's own words, else the server's, else a plain line. */
export function refusalWords(rejected: { reason: string; message: string | null } | undefined, t: (key: string) => string): string {
  const own = rejected ? refusalText(rejected.reason) : null;
  if (own) return t(own);
  return rejected?.message ?? t('FloorBeat did not take this scan.');
}
