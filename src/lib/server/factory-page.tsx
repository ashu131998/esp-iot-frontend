import type { ReactNode } from 'react';

import { clientPage, type FactoryPageProps } from '@/clients/registry';
import { requireFactoryPage } from '@/lib/server/page-guard';

/**
 * Wrap a factory page (its default export): the page shows "not found" when
 * our staff switched it off for the factory, and a factory with its own
 * version of the page (src/clients, last resort) gets that version on the same
 * URL. Every other factory gets the common page.
 */
export function factoryPage<P extends { params: Promise<{ factoryId: string }> }>(
  slug: string,
  CommonPage: (props: P) => ReactNode | Promise<ReactNode>,
) {
  return async function FactoryPage(props: P) {
    const { factoryId } = await props.params;
    await requireFactoryPage(factoryId, slug);
    const ClientVersion = clientPage(factoryId, slug);
    // Next.js passes every page both params and searchParams.
    if (ClientVersion) return <ClientVersion {...(props as unknown as FactoryPageProps)} />;
    return <CommonPage {...props} />;
  };
}
