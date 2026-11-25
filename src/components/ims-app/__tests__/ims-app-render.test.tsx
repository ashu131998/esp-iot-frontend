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
import type { ApiSetup, ApiStock } from '@/lib/ims/types';

const nav = { pathname: '/stock', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: null, loading: false, logout: vi.fn(async () => {}), refresh: vi.fn(async () => {}) }), getClientCsrf: () => 'csrf' }));

const { ImsAppShell, imsTabActive } = await import('@/components/ims-app/shell');
const { ImsApiError, isImsOff } = await import('@/lib/ims/api');
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

const SETUP: ApiSetup = {
  spec_fields: [
    { key: 'colour', label: 'Colour', options: [{ value: 'grey', label: 'Grey' }, { value: 'black', label: 'Black' }] },
    { key: 'size', label: 'Size', options: [{ value: 'm', label: 'M' }] },
  ],
  products: [],
  locations: [],
  photos_ready: true,
};
const product = (id: string, name: string, specs: Record<string, string>, picture: ApiStock['rows'][number]['product']['picture'] = null) =>
  ({ product_id: id, sku: id.toUpperCase(), name, unit: 'boxes', tracking: 'quantity' as const, specs, active: true, picture });
const PAGE: ApiStock = {
  rows: [
    { product: product('p1', 'Vitrified tile 600×600', { colour: 'grey', size: 'm' }), qty: 1240, unit: 'boxes', pallets: 14, uncounted_pallets: 0, needs_count_pallets: 0, oldest_stocked_at: '2026-11-01T05:00:00Z' },
    { product: product('p2', 'Wall tile 300×450', { colour: 'grey' }, { photo_id: 'ph', url: 'https://photos.example/f.jpg', thumb_url: 'https://photos.example/t.jpg', taken_at: '2026-11-20T05:00:00Z', taken_by: null }), qty: null, unit: 'boxes', pallets: 2, uncounted_pallets: 2, needs_count_pallets: 1, oldest_stocked_at: null },
  ],
  totals: { rows: 2, products: 2, pallets: 16, by_unit: [{ unit: 'boxes', qty: 1240, pallets: 16, uncounted_pallets: 2 }] },
  filters: {
    specs: { colour: [{ value: 'grey', label: 'Grey', pallets: 16 }, { value: 'black', label: 'Black', pallets: 12 }] },
    zones: [{ zone: 'Z2', pallets: 9 }],
    products: [],
  },
  next: null,
};

const seedStock = (search: string, page: ApiStock) => (c: QueryClient) => {
  const query = stockFilterQuery(parseStockFilter(new URLSearchParams(search)));
  c.setQueryData(['ims-setup', 'shree-tiles'], SETUP);
  c.setQueryData(['ims-stock', 'shree-tiles', query], { pages: [page], pageParams: [null] });
};

describe('the frame', () => {
  it('has Home and Available stock, the page\'s tab lit', () => {
    nav.pathname = '/stock';
    const html = render(<ImsAppShell factoryName="Shree Tiles"><p>page</p></ImsAppShell>);
    expect(html).toContain('FloorBeat IMS');
    expect(html).toContain('Shree Tiles');
    expect(html).toMatch(/aria-current="page"[^>]*>[\s\S]*Available stock/);
    expect(html).toContain('aria-label="Sign out"');
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
    nav.search = 'spec.colour=grey&zone=Z2';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, PAGE));
    expect(html).toContain('1,240 boxes · 2 pallets not counted');
    expect(html.replace(/<!-- -->/g, '')).toContain('on 16 pallets · 2 products');
    expect(html.replace(/<!-- -->/g, '')).toMatch(/—\s*<span[^>]*>boxes/);
    expect(html).toContain('2 not counted');
    expect(html).toContain('1 needs count');
    expect(html).toContain('https://photos.example/t.jpg');
    expect(html).toContain('Grey · M');
  });

  it('shows the picked filters as chips, named as the sheet names them', () => {
    nav.search = 'spec.colour=grey&zone=Z2';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, PAGE)).replace(/<!-- -->/g, '');
    expect(html).toContain('Filters · 2');
    expect(html).toContain('Remove filter Grey');
    expect(html).toContain('Remove filter Z2');
  });

  it('nothing matching says so and offers to clear', () => {
    nav.search = 'spec.colour=black';
    const empty: ApiStock = { ...PAGE, rows: [], totals: { rows: 0, products: 0, pallets: 0, by_unit: [] } };
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

  it('a factory without IMS switched on is told so, not "try again" (the API\'s 403)', () => {
    expect(isImsOff(new ImsApiError('The IMS is not switched on for this factory', 403))).toBe(true);
    expect(isImsOff(new ImsApiError('Request failed (500)', 500))).toBe(false);
    expect(isImsOff(new Error('offline'))).toBe(false);
  });

  it('in Hindi', () => {
    nav.search = '';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock('', PAGE), hi).replace(/<!-- -->/g, '');
    expect(html).toContain('उपलब्ध माल');
    expect(html).toContain('1,240 boxes · 2 पैलेट की गिनती बाकी');
  });
});
