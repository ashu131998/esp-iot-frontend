import type { ReactNode } from 'react';

/** What Next.js passes a factory page: route params and the query string. */
export interface FactoryPageProps {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export type FactoryPageComponent = (props: FactoryPageProps) => ReactNode | Promise<ReactNode>;

/**
 * Client versions of factory pages: factory id → page slug → that client's
 * page, shown on the same URL instead of the common page (see factoryPage in
 * lib/server/factory-page.tsx). Last resort — read README.md first. Empty
 * until a client truly needs one.
 *
 * Example:
 *   import { AcmeProductionPage } from './acme/production';
 *   'factory-acme-01': { production: AcmeProductionPage },
 */
export const CLIENT_PAGES: Record<string, Partial<Record<string, FactoryPageComponent>>> = {};

/** The factory's own version of a page, if it has one. */
export function clientPage(
  factoryId: string,
  slug: string,
  pages: Record<string, Partial<Record<string, FactoryPageComponent>>> = CLIENT_PAGES,
): FactoryPageComponent | undefined {
  return Object.hasOwn(pages, factoryId) ? pages[factoryId][slug] : undefined;
}
