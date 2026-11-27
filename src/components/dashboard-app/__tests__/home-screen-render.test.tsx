/**
 * The FloorBeat app's home screen of apps, rendered (server render): for a factory's people, and for our staff on the
 * factory they picked (2026-11-27: "in desktop too i need list of apps in the next step"), whose tiles open the
 * factory's own pages and who have no alerts of their own.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: null, loading: false, logout: vi.fn(async () => {}), refresh: vi.fn(async () => {}) }), getClientCsrf: () => 'csrf' }));

const { AppHomeScreen } = await import('@/components/dashboard-app/home-screen');

function render(node: ReactNode, messages: Record<string, string> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
}

const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);

describe('the home screen for our staff, on the factory they picked', () => {
  const staff = () => render(
    <AppHomeScreen factoryId="shree-mills" factoryName="Shree Mills" logoSrc={null} tiles={['alerts', 'dashboard', 'stock']} staff />,
  );

  it('its apps open the factory\'s own: its Alerts page, its dashboard, its Stock app; and the way back to the factories', () => {
    const html = staff();
    expect(hrefs(html)).toEqual(['/', '/factories/shree-mills/alerts', '/factories/shree-mills', '/factories/shree-mills/ims/stock']);
    expect(html).toContain('All factories');
    expect(html).toContain('Shree Mills');
    for (const name of ['Alerts', 'Dashboard', 'Stock']) expect(html).toContain(`>${name}</span>`);
  });

  it('no alerts of their own: no unread count, no inbox line, no asking to ring', () => {
    const html = staff();
    expect(html).not.toContain('unread');
    expect(html).not.toContain('No new alerts');
    expect(html).not.toContain('Turn on notifications');
  });

  it('in Hindi', () => {
    const html = render(<AppHomeScreen factoryId="shree-mills" factoryName="Shree Mills" logoSrc={null} tiles={['alerts', 'dashboard']} staff />, hi);
    expect(html).toContain(hi['All factories']);
    expect(html).toContain(hi.Dashboard);
  });
});

describe('the home screen for the factory\'s people (as before)', () => {
  it('its apps at the app\'s own addresses; no way to other factories', () => {
    const html = render(<AppHomeScreen factoryId="shree-mills" factoryName="Shree Mills" logoSrc={null} tiles={['dashboard', 'stock']} />);
    expect(hrefs(html)).toEqual(['/overview', '/ims/stock']);
    expect(html).not.toContain('All factories');
    expect(html).toContain('FloorBeat');
  });
});
