'use client';

import { useState } from 'react';

import { Sheet } from '@/components/ui/sheet';
import { useT } from '@/lib/i18n/context';
import { EMPTY_FILTER, isPicked, toggleChoice, type StockFilter } from '@/lib/ims/stock-filter';
import type { Facet } from '@/lib/ims/types';
import { cn } from '@/lib/utils';

/** A filter section's title: the item's own word for its field; ours for the location's parts and the item. */
function facetTitle(facet: Facet, t: (key: string) => string): string {
  if (facet.kind === 'zone') return t('Zone');
  if (facet.kind === 'row') return t('Row');
  if (facet.kind === 'column') return t('Column');
  if (facet.kind === 'product') return t('Item');
  return facet.label;
}

/**
 * The "Filters" sheet: one section per pick-list of the item picked (the stock page's item chips pick it), then the
 * parts of the location (zone, row, column), where records have one. Big chips, no typing. Each chip says how many
 * entries in stock it would leave (the server counts each field without its own pick, so the other colours stay
 * there to switch to). With all items showing, it says to pick one for its details. The choice is applied when the
 * sheet closes with "Show".
 */
export function FilterSheet({ facets, filter, onApply, onClose }: {
  facets: Facet[];
  filter: StockFilter;
  onApply: (filter: StockFilter) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState(filter);

  return (
    <Sheet title={t('Filters')} onClose={onClose}>
      <div className="space-y-5">
        {filter.products.length !== 1 && <p className="text-sm text-muted">{t('Pick one item above to filter by its details.')}</p>}
        {facets.filter((f) => f.options.length > 0).map((facet) => (
          <section key={`${facet.kind}:${facet.key}`}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{facetTitle(facet, t)}</h3>
            <div className="flex flex-wrap gap-2">
              {facet.options.map((o) => {
                const on = isPicked(draft, facet, o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft((d) => toggleChoice(d, facet, o.key))}
                    className={cn(
                      'h-11 rounded-full border px-4 text-sm',
                      on ? 'border-2 border-primary bg-primary/5 font-medium text-primary' : 'border-slate-300 text-foreground',
                    )}
                  >
                    {o.label} <span className={on ? 'text-primary/70' : 'text-muted'}>· {o.pallets}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => setDraft(EMPTY_FILTER)} className="h-14 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">
            {t('Clear all')}
          </button>
          <button type="button" onClick={() => onApply(draft)} className="h-14 flex-1 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            {t('Show')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
