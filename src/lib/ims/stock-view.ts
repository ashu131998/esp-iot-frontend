/**
 * How the stock figures read. A quantity nobody counted is never shown as 0: a row with no known
 * count shows "—", and a total says how many pallets it leaves out ("1,240 boxes · 2 pallets not counted").
 */
import { formatUpTo } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locale';
import type { Translator } from '@/lib/i18n/translate';

import type { ApiSpecField, ApiStock, Facet, SpecField, Specs, StockRow, StockView, UnitTotal } from './types';

/**
 * A quantity for the screen: "1,240", "12.9" (kg, m and litres keep up to 3 decimals, as the server
 * does), or "—" when nobody has counted it.
 */
export function qtyText(qty: number | null | undefined, locale: Locale = 'en'): string {
  return qty === null || qty === undefined || !Number.isFinite(qty) ? '—' : formatUpTo(qty, 3, locale);
}

/**
 * One unit's total, in words: "1,240 boxes", "1,240 boxes · 2 pallets not counted",
 * "— boxes · 3 pallets not counted" (nothing counted yet). The unit is the factory's own word, shown as typed.
 */
export function unitTotalText(total: UnitTotal, t: Translator['t'], tn: Translator['tn'], locale: Locale = 'en'): string {
  const amount = `${qtyText(total.qty, locale)} ${total.unit}`;
  if (total.uncounted_pallets <= 0) return amount;
  const left = tn(total.uncounted_pallets, '{count} pallet not counted', '{count} pallets not counted', { count: total.uncounted_pallets });
  return `${amount} · ${left}`;
}

/** A row's specs in the factory's own words and order: "Grey · M · A" (a value the fields do not know shows as stored). */
export function specsText(specs: Specs, fields: SpecField[]): string {
  const known = fields.filter((f) => specs[f.key]).map((f) => f.options.find((o) => o.key === specs[f.key])?.label ?? specs[f.key]);
  const extra = Object.keys(specs).filter((k) => !fields.some((f) => f.key === k)).sort().map((k) => specs[k]);
  return [...known, ...extra].join(' · ');
}

/** Whole days from an ISO date (yyyy-mm-dd or a time) to now, never below 0; null when unknown. */
export function ageDays(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const at = Date.parse(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}

/** The spec fields as the screens use them (a choice's `value` is its key). */
export function specFieldsOf(fields: ApiSpecField[] | null | undefined): SpecField[] {
  return (fields ?? []).map((f) => ({ key: f.key, label: f.label, options: f.options.map((o) => ({ key: o.value, label: o.label })) }));
}

/** A row or column as its labels and location codes write it (R03, C05); a zone as named. */
export function placeLabel(kind: 'zone' | 'row' | 'column', value: unknown): string {
  if (kind === 'zone') return String(value);
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? `${kind === 'row' ? 'R' : 'C'}${String(n).padStart(2, '0')}` : String(value);
}

/**
 * The stock page's view from the API's answer (GET …/ims/stock) and the factory's spec fields
 * (GET …/ims/setup): filter sections in the factory's order of its specs, then the location's parts
 * and the products; each line keyed by product and specs; the FIFO date the server's, else the
 * oldest stock-in. Words for the location's parts ("Zone", "Row", "Column") are the screen's.
 */
export function toStockView(api: ApiStock, fields: SpecField[]): StockView {
  const known = new Set(fields.map((f) => f.key));
  const specFacets: Facet[] = [
    ...fields.filter((f) => api.filters.specs[f.key]).map((f) => ({ key: f.key, label: f.label, kind: 'spec' as const, options: api.filters.specs[f.key] })),
    ...Object.keys(api.filters.specs).filter((k) => !known.has(k)).sort().map((k) => ({ key: k, label: k, kind: 'spec' as const, options: api.filters.specs[k] })),
  ].map((f) => ({ ...f, options: f.options.map((o) => ({ key: o.value, label: o.label, pallets: o.pallets })) }));
  const place = (kind: 'zone' | 'row' | 'column', list: Array<{ pallets: number } & Record<string, unknown>> | undefined): Facet[] =>
    list && list.length ? [{ key: kind, label: kind, kind, options: list.map((o) => ({ key: String(o[kind]), label: placeLabel(kind, o[kind]), pallets: o.pallets })) }] : [];
  const products: Facet[] = api.filters.products?.length
    ? [{ key: 'product', label: 'product', kind: 'product', options: api.filters.products.map((p) => ({ key: p.product_id, label: p.name, pallets: p.pallets })) }]
    : [];
  const rows: StockRow[] = api.rows.map((r) => {
    const specs = r.specs ?? r.product.specs ?? {};
    return {
      key: `${r.product.product_id}:${Object.keys(specs).sort().map((k) => `${k}=${specs[k]}`).join('&')}`,
      product_id: r.product.product_id,
      sku: r.product.sku,
      name: r.product.name,
      unit: r.unit ?? r.product.unit,
      specs,
      qty: r.qty,
      uncounted_pallets: r.uncounted_pallets ?? 0,
      needs_count_pallets: r.needs_count_pallets ?? 0,
      pallets: r.pallets,
      oldest_on: r.oldest_on ?? r.oldest_stocked_at ?? null,
      thumb_url: r.product.picture?.thumb_url ?? null,
    };
  });
  return {
    rows,
    totals: { rows: api.totals.rows, pallets: api.totals.pallets, by_unit: api.totals.by_unit },
    facets: [...specFacets, ...place('zone', api.filters.zones), ...place('row', api.filters.rows), ...place('column', api.filters.columns), ...products],
    spec_fields: fields,
    next_cursor: api.next,
  };
}
