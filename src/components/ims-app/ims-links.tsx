'use client';

import { createContext, useCallback, useContext } from 'react';

import { imsHref } from '@/lib/ims/tab';

/**
 * Where the IMS screens live: at the root of ims.floorbeat.in ('' — /, /scan, /stock), or as the Stock tab of
 * the dashboard (its /ims address: /ims, /ims/scan, /ims/stock on the FloorBeat app; /factories/<id>/ims… on
 * the long addresses). The screens link through imsHref, so they work in both.
 */
const ImsBaseContext = createContext('');

export function ImsLinksProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <ImsBaseContext.Provider value={base.replace(/\/+$/, '')}>{children}</ImsBaseContext.Provider>;
}

export function useImsHref(): (to: string) => string {
  const base = useContext(ImsBaseContext);
  return useCallback((to: string) => imsHref(base, to), [base]);
}

/** Whether the IMS screens are a tab of the dashboard (not the IMS app's own address). */
export function useImsInDashboard(): boolean {
  return useContext(ImsBaseContext) !== '';
}
