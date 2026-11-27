'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ImageOff, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { FilterSheet } from '@/components/ims-app/filter-sheet';
import { useImsHref } from '@/components/ims-app/ims-links';
import { LoadMore } from '@/components/ui/load-more';
import { useLocale, useT } from '@/lib/i18n/context';
import { imsApi, retryImsCall, stockProblem } from '@/lib/ims/api';
import { itemChoiceFields } from '@/lib/ims/fields';
import { EMPTY_FILTER, parseStockFilter, pickedCount, stockFilterQuery, toggleChoice, type StockFilter } from '@/lib/ims/stock-filter';
import { ageDays, qtyText, specFieldsOf, specsText, toStockView, unitTotalText } from '@/lib/ims/stock-view';
import type { Facet, FacetKind, StockRow } from '@/lib/ims/types';
import { useNavigate } from '@/lib/navigation-context';
import { cn } from '@/lib/utils';

/** The chips of what is picked, named as the filter sheet names them. */
function pickedChips(filter: StockFilter, facets: Facet[]) {
  const label = (kind: FacetKind, key: string, choice: string) =>
    facets.find((f) => f.kind === kind && (kind !== 'spec' || f.key === key))?.options.find((o) => o.key === choice)?.label ?? choice;
  const plain = (kind: Exclude<FacetKind, 'spec'>, values: string[]) =>
    values.map((v) => ({ facet: { key: kind, kind }, choice: v, text: label(kind, kind, v) }));
  return [
    ...Object.entries(filter.specs).flatMap(([key, values]) => values.map((v) => ({ facet: { key, kind: 'spec' as const }, choice: v, text: label('spec', key, v) }))),
    ...plain('zone', filter.zones),
    ...plain('row', filter.rows),
    ...plain('column', filter.columns),
  ];
}

/**
 * Available stock: the items as a row of chips (All, then each item with stock), the total for the whole filter
 * (worked out by the server; entries nobody counted are said, never added in as 0), the picked filters as chips
 * that come off with a tap, then one line per item and its pick-list values with its quantity, entries and the
 * oldest entry's age (FIFO). Each item has its own fields, so Filters offers the picked item's (and the place's,
 * where records have one). The list grows as it scrolls. The filter lives in the address (a link or bookmark keeps
 * it); a change replaces the address rather than adding a step, so Back leaves the page.
 */
export function StockScreen({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const imsLink = useImsHref();
  const params = useSearchParams();
  const filter = useMemo(() => parseStockFilter(new URLSearchParams(params.toString())), [params]);
  const query = stockFilterQuery(filter);
  const [sheet, setSheet] = useState(false);

  // The items and their fields name the chips and the filter sections, in their own order (kept long: they rarely change).
  const setup = useQuery({
    queryKey: ['ims-setup', factoryId],
    queryFn: ({ signal }) => imsApi.setup(factoryId, signal),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: retryImsCall,
  });
  const stock = useInfiniteQuery({
    queryKey: ['ims-stock', factoryId, query],
    queryFn: ({ pageParam, signal }) => imsApi.stock(factoryId, query, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    placeholderData: keepPreviousData,   // a changed filter keeps the old list until the new one is here
    refetchOnWindowFocus: false,
    retry: retryImsCall,
  });

  const go = useCallback((next: StockFilter) => {
    const q = stockFilterQuery(next);
    navigate(imsLink(q ? `/stock?${q}` : '/stock'));
  }, [imsLink, navigate]);

  const items = useMemo(() => new Map((setup.data?.products ?? []).map((p) => [p.product_id, p])), [setup.data]);
  // a field is one item's: the filters offer the picked item's, and none while all items show
  const item = filter.products.length === 1 ? items.get(filter.products[0]) : undefined;
  const fields = useMemo(() => specFieldsOf(itemChoiceFields(item)), [item]);
  const fieldsOf = useCallback((productId: string) => specFieldsOf(itemChoiceFields(items.get(productId))), [items]);
  const views = useMemo(() => (stock.data?.pages ?? []).map((p) => toStockView(p, fields)), [stock.data, fields]);
  const first = setup.data ? views[0] : undefined;
  const problem = stockProblem(setup.error) ?? stockProblem(stock.error);
  const rows: StockRow[] = views.flatMap((v) => v.rows);
  // the items are the chips above; the sheet holds the rest
  const facets = (first?.facets ?? []).filter((f) => f.kind !== 'product');
  const itemChoices = (first?.facets ?? []).find((f) => f.kind === 'product')?.options ?? [];
  const chips = pickedChips(filter, facets);
  const picked = pickedCount(filter) - filter.products.length;
  const showItem = (productId: string | null) => go({ ...filter, products: productId ? [productId] : [], specs: {} });

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">{t('Available stock')}</h1>

      {itemChoices.length > 0 && (
        <nav aria-label={t('Items')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            type="button"
            aria-pressed={filter.products.length === 0}
            onClick={() => showItem(null)}
            className={cn('h-11 shrink-0 rounded-full px-4 font-medium', filter.products.length === 0 ? 'bg-primary text-white' : 'bg-white text-foreground ring-1 ring-slate-300')}
          >
            {t('All items')}
          </button>
          {itemChoices.map((o) => {
            const on = filter.products.length === 1 && filter.products[0] === o.key;
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={on}
                onClick={() => showItem(on ? null : o.key)}
                className={cn('h-11 shrink-0 rounded-full px-4 font-medium', on ? 'bg-primary text-white' : 'bg-white text-foreground ring-1 ring-slate-300')}
              >
                {o.label}
              </button>
            );
          })}
        </nav>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setSheet(true)}
          disabled={!first || facets.every((f) => f.options.length === 0)}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 font-medium ring-1 ring-slate-300 disabled:opacity-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {picked > 0 ? t('Filters · {count}', { count: picked }) : t('Filters')}
        </button>
        {chips.map((c) => (
          <button
            key={`${c.facet.kind}:${c.facet.key}:${c.choice}`}
            type="button"
            onClick={() => go(toggleChoice(filter, c.facet, c.choice))}
            aria-label={t('Remove filter {name}', { name: c.text })}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary/5 px-4 font-medium text-primary"
          >
            {c.text} <X className="h-4 w-4" />
          </button>
        ))}
      </div>

      {!first && problem === 'off' ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-base text-foreground">{t('FloorBeat IMS is not switched on for this factory. Ask FloorBeat to switch it on.')}</p>
        </div>
      ) : !first && problem === 'filter' ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-base text-foreground">{t('These filters can no longer be used.')}</p>
          <button type="button" onClick={() => go(EMPTY_FILTER)} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">
            {t('Clear all')}
          </button>
        </div>
      ) : !first && problem === 'denied' ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-base text-foreground">{t('Your account cannot see this factory\'s stock. Ask your factory admin.')}</p>
        </div>
      ) : (stock.isError || setup.isError) && !first ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-base text-foreground">{t('Could not load the stock.')}</p>
          <button type="button" onClick={() => { void setup.refetch(); void stock.refetch(); }} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">
            {t('Try again')}
          </button>
        </div>
      ) : !first ? (
        <StockSkeleton />
      ) : (
        <div className={cn('space-y-3 transition-opacity', stock.isPlaceholderData && 'opacity-60')}>
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100" aria-label={t('Available now')}>
            <p className="text-sm text-muted">{t('Available now')}</p>
            {first.totals.by_unit.length === 0 ? (
              <p className="text-2xl font-semibold text-foreground">{t('Nothing in stock')}</p>
            ) : (
              first.totals.by_unit.map((u) => (
                <p key={u.unit} className="text-2xl font-semibold text-foreground">{unitTotalText(u, t, tn, locale)}</p>
              ))
            )}
            {first.totals.pallets > 0 && (
              <p className="text-sm text-muted">
                {tn(first.totals.pallets, 'in {count} entry', 'in {count} entries', { count: first.totals.pallets })}
                {Number.isFinite(first.totals.products) && first.totals.products > 0 && (
                  <>{' · '}{tn(first.totals.products, '{count} item', '{count} items', { count: first.totals.products })}</>
                )}
              </p>
            )}
          </section>

          {rows.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-base text-foreground">{picked > 0 ? t('Nothing in stock matches these filters.') : t('Nothing in stock yet.')}</p>
              {picked > 0 && (
                <button type="button" onClick={() => go(EMPTY_FILTER)} className="mt-3 h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">
                  {t('Clear all')}
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              {rows.map((r) => {
                const age = ageDays(r.oldest_on);
                const specs = specsText(r.specs, fieldsOf(r.product_id));
                return (
                  <li key={r.key} className="flex items-center gap-3 p-3">
                    {r.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a short-lived R2 link, not a file of ours
                      <img src={r.thumb_url} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-cover" />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400" aria-hidden><ImageOff className="h-5 w-5" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{r.name}</p>
                      {specs && <p className="truncate text-sm text-muted">{specs}</p>}
                      {age !== null && <p className="text-xs text-muted">{tn(age, 'Oldest: {count} day', 'Oldest: {count} days', { count: age })}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold text-foreground">{qtyText(r.qty, locale)} <span className="text-sm font-normal text-muted">{r.unit}</span></p>
                      <p className="text-xs text-muted">{tn(r.pallets, '{count} entry', '{count} entries', { count: r.pallets })}</p>
                      {r.needs_count_pallets > 0 && (
                        <p className="text-xs font-medium text-amber-700">{tn(r.needs_count_pallets, '{count} needs count', '{count} need count', { count: r.needs_count_pallets })}</p>
                      )}
                      {r.uncounted_pallets > 0 && (
                        <p className="text-xs font-medium text-amber-700">{tn(r.uncounted_pallets, '{count} not counted', '{count} not counted', { count: r.uncounted_pallets })}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <LoadMore
            shown={rows.length}
            total={Math.max(first.totals.rows, rows.length)}
            hasMore={Boolean(stock.hasNextPage)}
            loading={stock.isFetchingNextPage}
            onMore={() => { if (stock.hasNextPage && !stock.isFetchingNextPage) void stock.fetchNextPage(); }}
          />
        </div>
      )}

      {sheet && first && (
        <FilterSheet
          facets={facets}
          filter={filter}
          onClose={() => setSheet(false)}
          onApply={(next) => { setSheet(false); go(next); }}
        />
      )}
    </div>
  );
}

/** The stock page's place while it first loads: the summary and four rows, at their own heights. */
function StockSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-[6.5rem] animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-100" />
      <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="h-14 w-14 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
