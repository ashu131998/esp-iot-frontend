import { notFound } from 'next/navigation';

import { displayOf, isShown, type Display } from '@/lib/display';
import { serverApi } from '@/lib/server-api';

/**
 * Stop a factory page that our staff switched off for this factory: the menu
 * already hides it, and a typed or bookmarked URL shows "not found" instead.
 * Call it first in the page, before any data is fetched. Returns the factory's
 * display map for pages that switch their own sections on the server.
 *
 * The factory request is shared with the layout (serverApi is request-cached).
 */
export async function requireFactoryPage(factoryId: string, page: string): Promise<Display> {
  const display = displayOf(await serverApi.factory(factoryId));
  if (!isShown(display, page)) notFound();
  return display;
}
