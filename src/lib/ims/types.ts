/**
 * FloorBeat IMS, the stock app: the shapes of the backend's answers (query-api, every path under
 * /v1/factories/:factoryId/ims, reached through the BFF at /api/v1/…). Agreed with the backend in
 * Slack on 2026-11-25; the backend's branch is the source of truth once it lands.
 *
 * Stock is worked out from the movements log, pallet by pallet. A quantity nobody has counted is
 * null, never 0: it is shown as "—" and kept out of totals, which say how many pallets they leave out.
 */

/** A spec value per field key: { colour: 'grey', grade: 'a' } (keys and choice values, never labels). */
export type Specs = Record<string, string>;

// ── what the API sends (query-api ims.js / ims-routes.js, branch ai/backend-engineer/ims-api) ──

export interface ApiSpecField {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface ApiPicture {
  photo_id: string;
  url: string;
  thumb_url: string;
  taken_at: string;
  taken_by: string | null;
}

export interface ApiProduct {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  tracking: 'quantity' | 'serial';
  specs: Specs;
  active: boolean;
  picture?: ApiPicture | null;
}

/** GET …/ims/setup: what the phone keeps (also offline). */
export interface ApiSetup {
  spec_fields: ApiSpecField[];
  products: ApiProduct[];
  locations: Array<{ code: string; row: number; column: number; zone: string | null; name: string | null; active: boolean }>;
  photos_ready: boolean;
}

/** One unit's total: qty counts only pallets with a known count, null when none has one. */
export interface UnitTotal {
  unit: string;
  qty: number | null;
  pallets?: number;
  /** In-stock pallets in this unit whose quantity nobody has counted. */
  uncounted_pallets: number;
}

export interface ApiStockRow {
  product: ApiProduct;
  /** A row's own specs once they are the pallets' (else the product's). */
  specs?: Specs;
  qty: number | null;
  unit: string;
  pallets: number;
  uncounted_pallets: number;
  needs_count_pallets: number;
  oldest_stocked_at: string | null;
  /** The FIFO date when the server sends it (production date, else stock-in). */
  oldest_on?: string | null;
}

/** GET …/ims/stock. A location is a row and a column (code R03-C05), with a zone if the factory uses them. */
export interface ApiStock {
  rows: ApiStockRow[];
  totals: { rows: number; pallets: number; by_unit: UnitTotal[] };
  filters: {
    specs: Record<string, Array<{ value: string; label: string; pallets: number }>>;
    zones?: Array<{ zone: string; pallets: number }>;
    rows?: Array<{ row: number; pallets: number }>;
    columns?: Array<{ column: number; pallets: number }>;
    products?: Array<{ product_id: string; name: string; pallets: number }>;
  };
  next: string | null;
}

// ── what the screens draw (lib/ims/stock-view.ts toStockView) ──

export interface SpecChoice {
  key: string;
  label: string;
}

/** One spec the factory has set up (Colour), with its fixed choices (Grey, Black, White). */
export interface SpecField {
  key: string;
  label: string;
  options: SpecChoice[];
}

/** A filter chip's choice and how many in-stock pallets it would leave (its own facet not applied). */
export interface FacetChoice extends SpecChoice {
  pallets: number;
}

export type FacetKind = 'spec' | 'zone' | 'row' | 'column' | 'product';

/** The choices of one filter: a spec field, a part of the location, or the product. */
export interface Facet {
  key: string;
  label: string;
  kind: FacetKind;
  options: FacetChoice[];
}

/** One line of the stock list: a product (with its specs) and what is in stock. */
export interface StockRow {
  key: string;
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  specs: Specs;
  qty: number | null;
  uncounted_pallets: number;
  needs_count_pallets: number;
  pallets: number;
  /** The oldest pallet's FIFO date (ISO); null if unknown. */
  oldest_on: string | null;
  /** A read link to a small photo (valid an hour), or null. */
  thumb_url: string | null;
}

export interface StockView {
  rows: StockRow[];
  /** For the whole filter, not only this page: one line per unit (boxes and kg are never added). */
  totals: { rows: number; pallets: number; by_unit: UnitTotal[] };
  facets: Facet[];
  spec_fields: SpecField[];
  next_cursor: string | null;
}
