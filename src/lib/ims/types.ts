/**
 * FloorBeat IMS, the stock app: the shapes of the backend's answers (query-api, every path under
 * /v1/factories/:factoryId/ims, reached through the BFF at /api/v1/…). Agreed with the backend in
 * Slack on 2026-11-25; the backend's branch is the source of truth once it lands.
 *
 * Stock is worked out from the movements log, pallet by pallet. A quantity nobody has counted is
 * null, never 0: it is shown as "—" and kept out of totals, which say how many pallets they leave out.
 */

/** A spec value per field key: { colour: 'grey', grade: 'a' } (keys and choice keys, never labels). */
export type Specs = Record<string, string>;

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

/** A filter chip's choice and how many in-stock pallets it would leave (its own field not applied). */
export interface FacetChoice extends SpecChoice {
  pallets: number;
}

/** The choices of one filter: a spec field, or the location's row ("row"), or the product ("product"). */
export interface Facet {
  key: string;
  label: string;
  kind: 'spec' | 'row' | 'product';
  options: FacetChoice[];
}

/** A quantity in one unit: qty counts only pallets with a known count; null when none has one. */
export interface UnitTotal {
  unit: string;
  qty: number | null;
  /** In-stock pallets in this unit whose quantity nobody has counted. */
  uncounted_pallets: number;
}

/** One line of the stock list: a product with one combination of specs, and what is in stock. */
export interface StockRow {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  specs: Specs;
  qty: number | null;
  uncounted_pallets: number;
  pallets: number;
  /** The oldest pallet's FIFO date (produced_on, else stocked_at), an ISO date; null if unknown. */
  oldest_on: string | null;
  /** A read link to a small photo (valid an hour), or null. */
  thumb_url: string | null;
}

export interface StockPage {
  rows: StockRow[];
  /** For the whole filter, not only this page: one line per unit (boxes and kg are never added). */
  totals: { rows: number; pallets: number; products: number; by_unit: UnitTotal[] };
  facets: Facet[];
  /** The spec fields, to name a row's specs (Colour: Grey). */
  spec_fields: SpecField[];
  next_cursor: string | null;
}
