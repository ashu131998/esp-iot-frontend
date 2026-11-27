'use client';

import { createContext, useContext } from 'react';

import { factoryHrefFor } from '@/lib/factory-links';

/** Whether this factory's pages are shown at plain addresses (its own address, or the FloorBeat app); the factory shell says. */
const PlainLinksContext = createContext(false);
/** Whether this is the FloorBeat app's address (dashboard.floorbeat.in): one address for every factory. */
const SharedAddressContext = createContext(false);

export function FactoryLinksProvider({ plain, shared = false, children }: { plain: boolean; shared?: boolean; children: React.ReactNode }) {
  return (
    <PlainLinksContext.Provider value={plain}>
      <SharedAddressContext.Provider value={shared}>{children}</SharedAddressContext.Provider>
    </PlainLinksContext.Provider>
  );
}

/** For links to this factory's pages: wrap "/factories/<id>/…" in it (plain at its own address). */
export function useFactoryHref(): (href: string) => string {
  return factoryHrefFor(useContext(PlainLinksContext), useContext(SharedAddressContext));
}

/**
 * True in the FloorBeat app: every factory is served at this one address, so moving to another factory
 * or signing out stays here instead of going to a factory's own address.
 */
export function useSharedAddress(): boolean {
  return useContext(SharedAddressContext);
}
