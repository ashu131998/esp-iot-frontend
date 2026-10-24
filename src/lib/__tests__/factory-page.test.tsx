import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_PAGES, clientPage, type FactoryPageComponent } from '@/clients/registry';

vi.mock('@/lib/server/page-guard', () => ({ requireFactoryPage: vi.fn().mockResolvedValue({}) }));
vi.mock('@/clients/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/clients/registry')>();
  return { ...real, clientPage: vi.fn((factoryId: string, slug: string) => real.clientPage(factoryId, slug, TEST_PAGES)) };
});

const CommonPage = () => null;
const AcmeProduction: FactoryPageComponent = () => null;
const TEST_PAGES: Record<string, Partial<Record<string, FactoryPageComponent>>> = {
  'factory-acme-01': { production: AcmeProduction },
};

const { requireFactoryPage } = await import('@/lib/server/page-guard');
const { factoryPage } = await import('@/lib/server/factory-page');

const props = (factoryId: string) => ({
  params: Promise.resolve({ factoryId }),
  searchParams: Promise.resolve({ from: '2026-10-25' }),
});

describe('clientPage', () => {
  it('finds a client version only for its factory and page', () => {
    expect(clientPage('factory-acme-01', 'production', TEST_PAGES)).toBe(AcmeProduction);
    expect(clientPage('factory-acme-01', 'energy', TEST_PAGES)).toBeUndefined();
    expect(clientPage('factory-01', 'production', TEST_PAGES)).toBeUndefined();
    expect(clientPage('toString', 'production', TEST_PAGES)).toBeUndefined();
  });

  it('starts with no client versions', () => {
    expect(CLIENT_PAGES).toEqual({});
  });
});

describe('factoryPage', () => {
  beforeEach(() => vi.mocked(requireFactoryPage).mockClear());

  it('checks the page switch, then shows the common page', async () => {
    const page = factoryPage('production', CommonPage);
    const el = await page(props('factory-01'));
    expect(requireFactoryPage).toHaveBeenCalledWith('factory-01', 'production');
    expect(el.type).toBe(CommonPage);
    expect(el.props).toEqual({ params: expect.any(Promise), searchParams: expect.any(Promise) });
  });

  it("shows the factory's own version on the same URL, with the same props", async () => {
    const p = props('factory-acme-01');
    const el = await factoryPage('production', CommonPage)(p);
    expect(el.type).toBe(AcmeProduction);
    expect(el.props.params).toBe(p.params);
    expect(el.props.searchParams).toBe(p.searchParams);
  });

  it('stops a switched-off page before choosing a version', async () => {
    vi.mocked(requireFactoryPage).mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'));
    await expect(factoryPage('production', CommonPage)(props('factory-acme-01'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
