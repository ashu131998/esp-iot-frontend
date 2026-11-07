/**
 * The factory name in the sidebar and phone header (layout/plant-switcher.tsx), rendered on the
 * server: a plain name for everyone but a company's admin with several factories, for whom it is
 * a button that opens them. Choosing one is the backend's switch + the handoff route (tested there).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { hi } from '@/lib/i18n/messages/hi';
import { LocaleProvider } from '@/lib/i18n/context';

const auth: { user: { company_id?: string | null } | null } = { user: null };
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));

const { PlantSwitcher } = await import('@/components/layout/plant-switcher');

const PLANTS = [{ factory_id: 'grp-a', name: 'Unit A' }, { factory_id: 'grp-b', name: 'Unit B' }];

function render(user: typeof auth.user, plants = PLANTS, { tone = 'dark', locale = 'en' }: { tone?: 'dark' | 'light'; locale?: 'en' | 'hi' } = {}) {
  auth.user = user;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['auth-plants'], { plants, current: 'grp-a' });
  const node = (
    <QueryClientProvider client={client}>
      <PlantSwitcher factoryId="grp-a" factoryName="Unit A" subtitle="Surat" tone={tone} />
    </QueryClientProvider>
  );
  return renderToString(<LocaleProvider locale={locale} messages={locale === 'hi' ? hi : {}}>{node}</LocaleProvider>).replaceAll('<!-- -->', '');
}

describe('PlantSwitcher', () => {
  it('a plant\'s own account: just the name and where it is', () => {
    const html = render({ company_id: null });
    expect(html).toContain('Unit A');
    expect(html).toContain('Surat');
    expect(html).not.toContain('<button');
  });

  it('a company\'s admin with several factories: a button that opens them (closed at first)', () => {
    const html = render({ company_id: 'grp' });
    expect(html).toMatch(/<button[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"[^>]*aria-label="Switch factory"/);
    expect(html).toContain('Unit A');
    expect(html).not.toContain('Unit B');   // the list shows when opened
  });

  it('a company\'s admin with a single factory: nothing to switch to', () => {
    expect(render({ company_id: 'grp' }, [PLANTS[0]])).not.toContain('<button');
  });

  it('light on the phone header; in Hindi', () => {
    expect(render({ company_id: 'grp' }, PLANTS, { tone: 'light' })).toContain('hover:bg-slate-100');
    expect(render({ company_id: 'grp' }, PLANTS, { locale: 'hi' })).toContain('aria-label="फ़ैक्टरी बदलें"');
  });

  it('signed out (no user yet): the name', () => {
    expect(render(null)).not.toContain('<button');
  });
});
