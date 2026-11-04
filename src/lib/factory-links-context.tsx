'use client';

import { createContext, useContext } from 'react';

import { factoryHrefFor } from '@/lib/factory-links';

/** Whether this factory's pages are shown at its own address (plain links); the factory shell says. */
const PlainLinksContext = createContext(false);

export function FactoryLinksProvider({ plain, children }: { plain: boolean; children: React.ReactNode }) {
  return <PlainLinksContext.Provider value={plain}>{children}</PlainLinksContext.Provider>;
}

/** For links to this factory's pages: wrap "/factories/<id>/…" in it (plain at its own address). */
export function useFactoryHref(): (href: string) => string {
  return factoryHrefFor(useContext(PlainLinksContext));
}
