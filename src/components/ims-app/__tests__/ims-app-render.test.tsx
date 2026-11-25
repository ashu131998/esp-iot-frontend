/**
 * FloorBeat IMS's screens rendered with sample data (server render): the frame and its tabs, the
 * available stock with a filter (totals that say what is not counted, "—" for an uncounted line,
 * the picked chips), the empty and loading states; English and Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';
import { stockFilterQuery, parseStockFilter } from '@/lib/ims/stock-filter';
import type { StockPage } from '@/lib/ims/types';

const nav = { pathname: '/stock', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const { ImsAppShell, imsTabActive } = await import('@/components/ims-app/shell');
const { StockScreen } = await import('@/components/ims-app/stock-screen');

function render(node: ReactNode, seed: (client: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  );
}

const FIELDS = [
  { key: 'colour', label: 'Colour', options: [{ key: 'grey', label: 'Grey' }, { key: 'black', label: 'Black' }] },
  { key: 'size', label: 'Size', options: [{ key: 'm', label: 'M' }] },
];
const PAGE: StockPage = {
  rows: [
    { product_id: 'p1', sku: 'VT-600', name: 'Vitrified tile 600×600', unit: 'boxes', specs: { colour: 'grey', size: 'm' }, qty: 1240, uncounted_pallets: 0, pallets: 14, oldest_on: '2026-11-01', thumb_url: null },
    { product_id: 'p2', sku: 'WT-300', name: 'Wall tile 300×450', unit: 'boxes', specs: { colour: 'grey' }, qty: null, uncounted_pallets: 2, pallets: 2, oldest_on: null, thumb_url: 'https://photos.example/t.jpg' },
  ],
  totals: { rows: 2, pallets: 16, products: 2, by_unit: [{ unit: 'boxes', qty: 1240, uncounted_pallets: 2 }] },
  facets: [
    { key: 'colour', label: 'Colour', kind: 'spec', options: [{ key: 'grey', label: 'Grey', pallets: 16 }, { key: 'black', label: 'Black', pallets: 12 }] },
    { key: 'row', label: 'Row', kind: 'row', options: [{ key: 'R03', label: 'Row 3', pallets: 9 }] },
  ],
  spec_fields: FIELDS,
  next_cursor: null,
};

const seedStock = (search: string, page: StockPage) => (c: QueryClient) => {
  const query = stockFilterQuery(parseStockFilter(new URLSearchParams(search)));
  c.setQueryData(['ims-stock', 'shree-tiles', query], { pages: [page], pageParams: [null] });
};

describe('the frame', () => {
  it('has Home and Available stock, the page\'s tab lit', () => {
    nav.pathname = '/stock';
    const html = render(<ImsAppShell factoryName="Shree Tiles"><p>page</p></ImsAppShell>);
    expect(html).toContain('FloorBeat IMS');
    expect(html).toContain('Shree Tiles');
    expect(html).toMatch(/aria-current="page"[^>]*>[\s\S]*Available stock/);
  });

  it('lights the right tab at plain and inside addresses', () => {
    expect(imsTabActive('/', '/')).toBe(true);
    expect(imsTabActive('/', '/ims-app')).toBe(true);
    expect(imsTabActive('/', '/stock')).toBe(false);
    expect(imsTabActive('/stock', '/ims-app/stock')).toBe(true);
    expect(imsTabActive('/stock', '/stocktake')).toBe(false);
  });
});

describe('available stock', () => {
  it('the total says what is not counted; an uncounted line shows "—", never 0', () => {
    nav.search = 'spec.colour=grey&row=R03';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, PAGE));
    expect(html).toContain('1,240 boxes · 2 pallets not counted');
    expect(html.replace(/<!-- -->/g, '')).toContain('on 16 pallets · 2 products');
    expect(html.replace(/<!-- -->/g, '')).toMatch(/—\s*<span[^>]*>boxes/);
    expect(html).toContain('2 not counted');
    expect(html).toContain('Grey · M');
  });

  it('shows the picked filters as chips, named as the sheet names them', () => {
    nav.search = 'spec.colour=grey&row=R03';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, PAGE)).replace(/<!-- -->/g, '');
    expect(html).toContain('Filters · 2');
    expect(html).toContain('Remove filter Grey');
    expect(html).toContain('Remove filter Row 3');
  });

  it('nothing matching says so and offers to clear', () => {
    nav.search = 'spec.colour=black';
    const empty: StockPage = { ...PAGE, rows: [], totals: { rows: 0, pallets: 0, products: 0, by_unit: [] } };
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, empty));
    expect(html).toContain('Nothing in stock matches these filters.');
    expect(html).toContain('Clear all');
    expect(html).not.toMatch(/>0 boxes/);
  });

  it('before the stock is here: its place held, no figures', () => {
    nav.search = '';
    const html = render(<StockScreen factoryId="shree-tiles" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('Available now');
  });

  it('in Hindi', () => {
    nav.search = '';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock('', PAGE), hi).replace(/<!-- -->/g, '');
    expect(html).toContain('उपलब्ध माल');
    expect(html).toContain('1,240 boxes · 2 पैलेट की गिनती बाकी');
  });
});
