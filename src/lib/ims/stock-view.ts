/**
 * How the stock figures read. A quantity nobody counted is never shown as 0: a row with no known
 * count shows "—", and a total says how many pallets it leaves out ("1,240 boxes · 2 pallets not counted").
 */
import { formatInt } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locale';
import type { Translator } from '@/lib/i18n/translate';

import type { SpecField, Specs, UnitTotal } from './types';

/** A quantity for the screen: "1,240", or "—" when nobody has counted it. */
export function qtyText(qty: number | null | undefined, locale: Locale = 'en'): string {
  return qty === null || qty === undefined || !Number.isFinite(qty) ? '—' : formatInt(qty, locale);
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
