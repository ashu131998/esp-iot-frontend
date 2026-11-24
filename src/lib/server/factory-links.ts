import { headers } from 'next/headers';

import { PLAIN_LINKS_HEADER, factoryHrefFor } from '@/lib/factory-links';
import { factoryFromHost, isDashboardAppHost } from '@/lib/hosts';

/**
 * Whether this factory's links are plain here (/energy, not /factories/<id>/energy): at its own address
 * (<id>.floorbeat.in), and in the FloorBeat app for the factory the person is signed in at (the
 * middleware says so, PLAIN_LINKS_HEADER).
 */
export async function onFactoryAddress(factoryId: string): Promise<boolean> {
  const h = await headers();
  if (h.get(PLAIN_LINKS_HEADER) === '1') return true;
  return factoryFromHost(h.get('host'), process.env.FACTORY_HOST_SUFFIX) === factoryId.toLowerCase();
}

/** Whether this request is at the FloorBeat app's address (dashboard.floorbeat.in): one address for every factory. */
export async function onDashboardApp(): Promise<boolean> {
  return isDashboardAppHost((await headers()).get('host'), process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST);
}

/** Server pages' links to this factory's pages (see factory-links.ts). */
export async function factoryLinks(factoryId: string): Promise<(href: string) => string> {
  return factoryHrefFor(await onFactoryAddress(factoryId));
}
