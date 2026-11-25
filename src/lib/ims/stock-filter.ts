/**
 * The available-stock filter as it is written in the page's address and in the API call:
 * `spec.colour=grey,black&spec.size=m&zone=Z2&row=3&column=5&product=p1&older_than_days=30`.
 * Several choices of one spec mean any of them (OR); different specs must all match (AND).
 * Keys are kept in one order, so the same filter is always the same address (and the same cache entry).
 */

export interface StockFilter {
  /** Spec field key → the choice keys picked (any of them). */
  specs: Record<string, string[]>;
  /** Parts of the location (any of each): zones ("Z2"), row numbers ("3"), column numbers ("5"). */
  zones: string[];
  rows: string[];
  columns: string[];
  /** Products (any of them). */
  products: string[];
  /** Only pallets older than this many days (FIFO date). */
  olderThanDays: number | null;
}

export const EMPTY_FILTER: StockFilter = { specs: {}, zones: [], rows: [], columns: [], products: [], olderThanDays: null };

type FacetRef = { key: string; kind: 'spec' | 'zone' | 'row' | 'column' | 'product' };

const LISTS = { zone: 'zones', row: 'rows', column: 'columns', product: 'products' } as const;

const KEY_RE = /^[a-z0-9_-]{1,40}$/i;
const VALUE_RE = /^[^,]{1,60}$/;

function list(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (v && VALUE_RE.test(v)) seen.add(v);
  }
  return [...seen].sort();
}

/** The filter written in an address's query (unknown or broken parts are left out). */
export function parseStockFilter(params: URLSearchParams | Record<string, string | string[] | undefined>): StockFilter {
  const get = (name: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(name);
    const v = params[name];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const names = params instanceof URLSearchParams ? [...params.keys()] : Object.keys(params);
  const specs: Record<string, string[]> = {};
  for (const name of names) {
    const m = name.match(/^spec\.(.+)$/);
    if (!m || !KEY_RE.test(m[1])) continue;
    const values = list(get(name));
    if (values.length) specs[m[1]] = values;
  }
  const days = Number(get('older_than_days'));
  return {
    specs,
    zones: list(get('zone')),
    rows: list(get('row')),
    columns: list(get('column')),
    products: list(get('product')),
    olderThanDays: Number.isInteger(days) && days > 0 && days <= 3650 ? days : null,
  };
}

/** The filter as a query string, without "?" ("" for no filter); always in the same order. */
export function stockFilterQuery(filter: StockFilter): string {
  const parts: string[] = [];
  const add = (name: string, values: string[]) => {
    const clean = [...new Set(values)].filter((v) => VALUE_RE.test(v)).sort();
    if (clean.length) parts.push(`${encodeURIComponent(name)}=${clean.map(encodeURIComponent).join(',')}`);
  };
  for (const key of Object.keys(filter.specs).filter((k) => KEY_RE.test(k)).sort()) add(`spec.${key}`, filter.specs[key]);
  add('zone', filter.zones);
  add('row', filter.rows);
  add('column', filter.columns);
  add('product', filter.products);
  if (filter.olderThanDays) parts.push(`older_than_days=${filter.olderThanDays}`);
  return parts.join('&');
}

/** A choice switched on or off for one facet (a spec field, a part of the location, or the product). */
export function toggleChoice(filter: StockFilter, facet: FacetRef, choice: string): StockFilter {
  const flip = (values: string[]) => (values.includes(choice) ? values.filter((v) => v !== choice) : [...values, choice].sort());
  if (facet.kind !== 'spec') {
    const name = LISTS[facet.kind];
    return { ...filter, [name]: flip(filter[name]) };
  }
  const next = flip(filter.specs[facet.key] ?? []);
  const specs = { ...filter.specs };
  if (next.length) specs[facet.key] = next;
  else delete specs[facet.key];
  return { ...filter, specs };
}

/** Whether a choice is picked. */
export function isPicked(filter: StockFilter, facet: FacetRef, choice: string): boolean {
  if (facet.kind !== 'spec') return filter[LISTS[facet.kind]].includes(choice);
  return (filter.specs[facet.key] ?? []).includes(choice);
}

/** How many choices are picked in all (the "Filters · 3" count). */
export function pickedCount(filter: StockFilter): number {
  return Object.values(filter.specs).reduce((n, v) => n + v.length, 0)
    + filter.zones.length + filter.rows.length + filter.columns.length + filter.products.length + (filter.olderThanDays ? 1 : 0);
}
