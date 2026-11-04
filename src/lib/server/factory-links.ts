import { headers } from 'next/headers';

import { factoryHrefFor } from '@/lib/factory-links';
import { factoryFromHost } from '@/lib/hosts';

/** Whether this request is at the factory's own address (<id>.floorbeat.in), where its links are plain. */
export async function onFactoryAddress(factoryId: string): Promise<boolean> {
  const host = (await headers()).get('host');
  return factoryFromHost(host, process.env.FACTORY_HOST_SUFFIX) === factoryId.toLowerCase();
}

/** Server pages' links to this factory's pages (see factory-links.ts). */
export async function factoryLinks(factoryId: string): Promise<(href: string) => string> {
  return factoryHrefFor(await onFactoryAddress(factoryId));
}
