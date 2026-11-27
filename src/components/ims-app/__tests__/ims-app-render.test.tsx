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
const { ImsApiError, isImsOff, retryImsCall, stockProblem } = await import('@/lib/ims/api');
const { ImsCannotConnect } = await import('@/components/ims-app/cannot-connect');
const { StockScreen } = await import('@/components/ims-app/stock-screen');
const { AddItemScreen } = await import('@/components/ims-app/add-item-screen');
const { ImsQueueProvider } = await import('@/components/ims-app/queue-context');
const { scanLine, waitingWords } = await import('@/components/ims-app/queue-bar');
const { readArea } = await import('@/components/ims-app/qr-scanner');
const { ImsFactoryQueue } = await import('@/components/ims-app/factory-queue');
const { ImsDashboardFrame } = await import('@/components/ims-app/dashboard-frame');
const { useImsHref } = await import('@/components/ims-app/ims-links');

function render(node: ReactNode, seed: (client: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  );
}

const COLOUR_FIELD = { key: 'colour', label: 'Colour', type: 'choice' as const, required: false, sort: 0, options: [{ value: 'grey', label: 'Grey' }, { value: 'black', label: 'Black' }] };
const SIZE_FIELD = { key: 'size', label: 'Size', type: 'choice' as const, required: false, sort: 10, options: [{ value: 'm', label: 'M' }] };
const product = (id: string, name: string, specs: Record<string, string>, picture: ApiStock['rows'][number]['product']['picture'] = null) =>
  ({ product_id: id, sku: id.toUpperCase(), name, unit: 'boxes', tracking: 'quantity' as const, specs, active: true, picture, fields: [] });
// each item with its own fields: the floor tile has a colour and a size, the wall tile only a colour
const SETUP: ApiSetup = {
  products: [
    { ...product('p1', 'Vitrified tile 600×600', {}), fields: [COLOUR_FIELD, SIZE_FIELD] },
    { ...product('p2', 'Wall tile 300×450', {}), fields: [COLOUR_FIELD] },
  ],
  locations: [],
  photos_ready: true,
};
const PAGE: ApiStock = {
  rows: [
    { product: product('p1', 'Vitrified tile 600×600', { colour: 'grey', size: 'm' }), qty: 1240, unit: 'boxes', pallets: 14, uncounted_pallets: 0, needs_count_pallets: 0, oldest_stocked_at: '2026-11-01T05:00:00Z' },
    { product: product('p2', 'Wall tile 300×450', { colour: 'grey' }, { photo_id: 'ph', url: 'https://photos.example/f.jpg', thumb_url: 'https://photos.example/t.jpg', taken_at: '2026-11-20T05:00:00Z', taken_by: null }), qty: null, unit: 'boxes', pallets: 2, uncounted_pallets: 2, needs_count_pallets: 1, oldest_stocked_at: null },
  ],
  totals: { rows: 2, products: 2, pallets: 16, by_unit: [{ unit: 'boxes', qty: 1240, pallets: 16, uncounted_pallets: 2 }] },
  filters: {
    specs: { colour: [{ value: 'grey', label: 'Grey', pallets: 16 }, { value: 'black', label: 'Black', pallets: 12 }] },
    zones: [{ zone: 'Z2', pallets: 9 }],
    products: [{ product_id: 'p1', name: 'Vitrified tile 600×600', pallets: 14 }, { product_id: 'p2', name: 'Wall tile 300×450', pallets: 2 }],
  },
  next: null,
};

const seedStock = (search: string, page: ApiStock) => (c: QueryClient) => {
  const query = stockFilterQuery(parseStockFilter(new URLSearchParams(search)));
  c.setQueryData(['ims-setup', 'shree-tiles'], SETUP);
  c.setQueryData(['ims-stock', 'shree-tiles', query], { pages: [page], pageParams: [null] });
};

describe('the frame', () => {
  it('has Home, Add item and Available stock, the page\'s tab lit', () => {
    nav.pathname = '/stock';
    const html = render(<ImsAppShell factoryId="shree-tiles" factoryName="Shree Tiles"><p>page</p></ImsAppShell>);
    expect(html).toContain('href="/add"');
    expect(html).toContain('Add item');
    expect(html).not.toContain('Scan QR');
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
    expect(imsTabActive('/add', '/ims-app/add')).toBe(true);
    expect(imsTabActive('/add', '/stock')).toBe(false);
    // the FloorBeat app's addresses
    expect(imsTabActive('/stock', '/ims/stock')).toBe(true);
    expect(imsTabActive('/add', '/ims/add')).toBe(true);
    expect(imsTabActive('/add', '/ims/stock')).toBe(false);
    expect(imsTabActive('/stock', '/imsx/stock')).toBe(false);
  });
});

describe('the FloorBeat app\'s Stock: an app of its own, as its Alerts are (2026-11-27)', () => {
  it('the way back to the app\'s home screen and "Stock" on top; Add item and Available stock under /ims; no Home tab, no sign-out', () => {
    nav.pathname = '/ims/stock';
    const html = render(<ImsAppShell factoryId="shree-tiles" factoryName={null} inFloorBeat><p>page</p></ImsAppShell>);
    // the home screen of apps, as the Alerts' header has it
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*aria-label="Home"|<a [^>]*aria-label="Home"[^>]*href="\/"/);
    expect(html).toContain('>Stock</p>');
    expect(html).not.toContain('FloorBeat IMS');
    expect(html).toContain('href="/ims/add"');
    expect(html).toContain('href="/ims/stock"');
    expect(html).not.toContain('href="/add"');
    expect(html).not.toContain('href="/stock"');
    // two tabs and the Home link: nothing else to tap
    expect(html.match(/<a /g)?.length).toBe(3);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/ims\/stock"|href="\/ims\/stock"[^>]*aria-current="page"/);
    // signing out is on the home screen (as for the Alerts)
    expect(html).not.toContain('aria-label="Sign out"');
    // the dashboard's frame is not here: no sidebar, no dashboard bottom bar
    expect(html).not.toContain('All apps');
  });

  it('in Hindi', () => {
    nav.pathname = '/ims/add';
    const html = render(<ImsAppShell factoryId="shree-tiles" factoryName={null} inFloorBeat><p>page</p></ImsAppShell>, () => {}, hi);
    expect(html).toContain(`>${hi.Stock}</p>`);
    expect(html).toContain(hi['Add item']);
    expect(html).toContain(hi['Available stock']);
  });

  it('our staff: the factory they opened, its screens under its long address, Home its list of apps', () => {
    nav.pathname = '/factories/shree-tiles/ims/add';
    const html = render(
      <ImsAppShell factoryId="shree-tiles" factoryName={null} inFloorBeat base="/factories/shree-tiles/ims" home="/factories/shree-tiles/apps"><p>page</p></ImsAppShell>,
    );
    expect(html).toMatch(/<a [^>]*href="\/factories\/shree-tiles\/apps"[^>]*>|<a [^>]*aria-label="Home"[^>]*href="\/factories\/shree-tiles\/apps"/);
    expect(html).toContain('href="/factories/shree-tiles/ims/add"');
    expect(html).toContain('href="/factories/shree-tiles/ims/stock"');
    expect(html).not.toContain('href="/ims/');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/factories\/shree-tiles\/ims\/add"|href="\/factories\/shree-tiles\/ims\/add"[^>]*aria-current="page"/);
    expect(imsTabActive('/stock', '/factories/shree-tiles/ims/stock', '/factories/shree-tiles/ims')).toBe(true);
    expect(imsTabActive('/add', '/factories/shree-tiles/ims/stock', '/factories/shree-tiles/ims')).toBe(false);
  });

  it('the screens inside link under /ims (a filter picked, an added item\'s "See available stock"); plain on ims.floorbeat.in', () => {
    function Probe() {
      const imsLink = useImsHref();
      return <i>{`${imsLink('/stock?row=R03')}|${imsLink('/add')}`}</i>;
    }
    nav.pathname = '/ims/stock';
    expect(render(<ImsAppShell factoryId="shree-tiles" factoryName={null} inFloorBeat><Probe /></ImsAppShell>)).toContain('<i>/ims/stock?row=R03|/ims/add</i>');
    nav.pathname = '/stock';
    expect(render(<ImsAppShell factoryId="shree-tiles" factoryName={null}><Probe /></ImsAppShell>)).toContain('<i>/stock?row=R03|/add</i>');
  });
});

describe('available stock', () => {
  it('the total says what is not counted; an uncounted line shows "—", never 0', () => {
    nav.search = 'product=p1&spec.colour=grey&zone=Z2';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, PAGE));
    expect(html).toContain('1,240 boxes · 2 entries not counted');
    expect(html.replace(/<!-- -->/g, '')).toContain('in 16 entries · 2 items');
    expect(html.replace(/<!-- -->/g, '')).toMatch(/—\s*<span[^>]*>boxes/);
    expect(html).toContain('2 not counted');
    expect(html).toContain('1 needs count');
    expect(html).toContain('https://photos.example/t.jpg');
    expect(html).toContain('Grey · M');
  });

  it('shows the picked filters as chips, named as the sheet names them (the item is its own chip row)', () => {
    nav.search = 'product=p1&spec.colour=grey&zone=Z2';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock(nav.search, PAGE)).replace(/<!-- -->/g, '');
    expect(html).toContain('Filters · 2');
    expect(html).toContain('Remove filter Grey');
    expect(html).toContain('Remove filter Z2');
  });

  it('nothing matching says so and offers to clear', () => {
    nav.search = 'product=p1&spec.colour=black';
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
    // another 403 (a disabled account) is not "switched off"
    expect(isImsOff(new ImsApiError('Account disabled', 403))).toBe(false);
  });

  it('each problem gets its own words: off, a refused filter, no access, or worth trying again', () => {
    expect(stockProblem(null)).toBeNull();
    expect(stockProblem(new ImsApiError('The IMS is not switched on for this factory', 403))).toBe('off');
    expect(stockProblem(new ImsApiError('"purple" is not a choice of Colour', 422))).toBe('filter');
    expect(stockProblem(new ImsApiError('Account disabled', 403))).toBe('denied');
    expect(stockProblem(new ImsApiError('Unauthorized', 401))).toBe('denied');
    expect(stockProblem(new ImsApiError('Request failed (502)', 502))).toBe('other');
    expect(stockProblem(new TypeError('Failed to fetch'))).toBe('other');
  });

  it('a refusal is shown at once, never asked again; a fault is asked again twice', () => {
    expect(retryImsCall(0, new ImsApiError('off', 403))).toBe(false);
    expect(retryImsCall(0, new ImsApiError('bad filter', 422))).toBe(false);
    expect(retryImsCall(0, new ImsApiError('down', 502))).toBe(true);
    expect(retryImsCall(1, new TypeError('Failed to fetch'))).toBe(true);
    expect(retryImsCall(2, new TypeError('Failed to fetch'))).toBe(false);
  });

  it('the API not answering is said as it is, with Try again', () => {
    const html = render(<ImsCannotConnect />);
    expect(html).toContain('Could not reach FloorBeat.');
    expect(html).toContain('Try again');
    expect(html).not.toContain('Sign in with an account of that factory');
  });

  it('in Hindi', () => {
    nav.search = '';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock('', PAGE), hi).replace(/<!-- -->/g, '');
    expect(html).toContain('उपलब्ध माल');
    expect(html).toContain('1,240 boxes · 2 एंट्री की गिनती बाकी');
    expect(html).toContain('सभी आइटम');
  });

  it('the items are a row of chips, All first; each line\'s values in its own item\'s words', () => {
    nav.search = '';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock('', PAGE)).replace(/<!-- -->/g, '');
    expect(html).toMatch(/<nav aria-label="Items"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>All items</);
    expect(html).toContain('Vitrified tile 600×600');
    expect(html).toContain('Wall tile 300×450');
    expect(html).toContain('Grey · M');   // the floor tile's colour and size
    expect(html).toContain('in 16 entries');
    expect(html).toContain('14 entries');
    // with all items showing, no item's fields are offered: nothing to filter yet but the place
    expect(html).not.toContain('>Colour<');
  });

  it('one item picked: its chip lit', () => {
    nav.search = 'product=p2';
    const html = render(<StockScreen factoryId="shree-tiles" />, seedStock('product=p2', PAGE)).replace(/<!-- -->/g, '');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Wall tile 300×450</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>All items</);
    nav.search = '';
  });
});

describe('add item', () => {
  const seedSetup = (c: QueryClient) => c.setQueryData(['ims-setup', 'shree-tiles'], SETUP);

  it('starts at the factory\'s items: no QR to scan, no camera', () => {
    nav.pathname = '/add';
    const html = render(<ImsQueueProvider factoryId="shree-tiles"><AddItemScreen factoryId="shree-tiles" /></ImsQueueProvider>, seedSetup).replace(/<!-- -->/g, '');
    expect(html).toContain('Add item');
    expect(html).toContain('Which item?');
    expect(html).toContain('Vitrified tile 600×600');
    expect(html).toContain('Wall tile 300×450');
    expect(html).not.toMatch(/<video/i);
    expect(html).not.toContain('pallet');
  });

  it('in Hindi', () => {
    const html = render(<ImsQueueProvider factoryId="shree-tiles"><AddItemScreen factoryId="shree-tiles" /></ImsQueueProvider>, seedSetup, hi).replace(/<!-- -->/g, '');
    expect(html).toContain('आइटम जोड़ें');
    expect(html).toContain('कौन-सा आइटम?');
  });

  it('a factory with no items yet is told who sets them up', () => {
    const empty = (c: QueryClient) => c.setQueryData(['ims-setup', 'shree-tiles'], { ...SETUP, products: [] });
    const html = render(<ImsQueueProvider factoryId="shree-tiles"><AddItemScreen factoryId="shree-tiles" /></ImsQueueProvider>, empty).replace(/<!-- -->/g, '');
    expect(html).toContain('No items are set up yet. Ask FloorBeat to add them.');
  });

  it('a waiting add is named by its item and quantity; a label\'s scan by its codes', () => {
    const add = { client_id: 'c', type: 'in' as const, pallet: 'IT-0B9F3C1E5D2A4C8B', product_id: 'p1', qty: 40, scanned_at: '2026-11-27T10:00:00Z' };
    const names = (id: string) => (id === 'p1' ? 'Vitrified tile 600×600' : null);
    expect(scanLine({ movement: add }, names)).toBe('Vitrified tile 600×600 · 40');
    expect(scanLine({ movement: { ...add, qty: null } }, names)).toBe('Vitrified tile 600×600 · —');
    expect(scanLine({ movement: add })).toBe('p1 · 40');   // the item not on the phone (yet): its id
    expect(scanLine({ movement: { client_id: 'c', type: 'in', pallet: 'PL-000012', to: 'R03-C05', scanned_at: '2026-11-26T10:00:00Z' } })).toBe('PL-000012 → R03-C05');
    expect(scanLine({ movement: { client_id: 'c', type: 'out', pallet: 'PL-000012', scanned_at: '2026-11-26T10:00:00Z' } })).toBe('PL-000012');
  });

  it('a waiting card says why it waits, as the bar does', () => {
    const t = (k: string) => k;
    expect(waitingWords(null, t)).toContain('when the connection is back');
    expect(waitingWords('offline', t)).toContain('when the connection is back');
    expect(waitingWords('signed_out', t)).toContain('You are signed out');
    expect(waitingWords('denied', t)).toContain('This account cannot add stock');
  });

  it('the iPhone reader reads the middle square at the camera\'s own size, up to 1080', () => {
    expect(readArea(1280, 720)).toEqual({ sx: 280, sy: 0, side: 720, size: 720 });
    expect(readArea(720, 1280)).toEqual({ sx: 0, sy: 280, side: 720, size: 720 });
    expect(readArea(3840, 2160)).toEqual({ sx: 840, sy: 0, side: 2160, size: 1080 });
  });
});

describe('the dashboard\'s Stock tab (one app)', () => {
  it('the waiting scans are the factory frame\'s: on every page when IMS is on, nothing at all when it is off', () => {
    // off: the page alone, no queue (a factory without IMS never touches the phone's stock queue)
    expect(render(<ImsFactoryQueue factoryId="shree-tiles" on={false}><p>overview</p></ImsFactoryQueue>)).toBe('<p>overview</p>');
    // on: the page, and an empty bar slot that takes no room while nothing waits
    const html = render(<ImsFactoryQueue factoryId="shree-tiles" on><p>overview</p></ImsFactoryQueue>);
    expect(html).toContain('<p>overview</p>');
    expect(html).toContain('empty:hidden');
  });

  it('the Stock screens link under the tab\'s address, with its own row of two tabs (no home of its own)', () => {
    nav.pathname = '/factories/shree-tiles/ims/add';
    const html = render(
      <ImsFactoryQueue factoryId="shree-tiles" on>
        <ImsDashboardFrame factoryId="shree-tiles"><p>add item</p></ImsDashboardFrame>
      </ImsFactoryQueue>,
    );
    expect(html).toContain('href="/factories/shree-tiles/ims/add"');
    expect(html).toContain('href="/factories/shree-tiles/ims/stock"');
    // the FloorBeat app's home screen is the home: no Home tab
    expect(html).not.toContain('href="/factories/shree-tiles/ims"');
    expect(html.match(/<a /g)?.length).toBe(2);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/factories\/shree-tiles\/ims\/add"|href="\/factories\/shree-tiles\/ims\/add"[^>]*aria-current="page"/);
  });
});
