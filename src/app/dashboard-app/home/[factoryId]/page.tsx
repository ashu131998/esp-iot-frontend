import { HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { AppHomeScreen } from '@/components/dashboard-app/home-screen';
import { appTiles, homeTarget, staffTileHref, staffTiles } from '@/lib/dashboard-app';
import { logoUrl } from '@/lib/branding';
import { displayOf } from '@/lib/display';
import { isInternalStaff } from '@/lib/internal-auth';
import { serverApi } from '@/lib/server-api';
import { alertsAhead } from '@/lib/server/alerts-ahead';
import { sessionUser } from '@/lib/server/session-user';
import { STAFF_FACTORY_HEADER } from '@/lib/staff-factory';

export const dynamic = 'force-dynamic';

/**
 * The FloorBeat app's home screen (its root, dashboard.floorbeat.in/: the middleware serves it here for the
 * factory the person is signed in at): a tile for each of the person's apps (lib/dashboard-app.ts appTiles), the
 * same in the phone app, the iPhone's Home Screen app and a computer's browser. With one app only, it opens that.
 *
 * Our staff get it for the factory they picked (/factories/<id>/apps), with its apps at the factory's long addresses
 * (lib/dashboard-app.ts staffTiles, staffTileHref) and the way back to the factories.
 */
export default async function AppHomePage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  // our staff: the middleware names the factory they opened (from their session, even when the API is slow to say who)
  const named = (await headers()).get(STAFF_FACTORY_HEADER);
  const [factory, user, alerts] = await Promise.all([
    serverApi.factory(factoryId).catch(() => null),
    sessionUser(),
    // the person's alerts with the page, asked for alongside: the Alerts tile's line at once, the inbox opened from it too
    named === factoryId ? Promise.resolve(null) : alertsAhead(),
  ]);
  if (!factory) notFound();
  const staff = named === factoryId || isInternalStaff(user);
  const display = displayOf(factory);
  const tiles = staff ? staffTiles(display) : appTiles(display);
  const only = homeTarget(tiles);
  if (only) redirect(staff ? staffTileHref(tiles[0], factoryId) : only);
  const ahead = !staff && tiles.includes('alerts') ? alerts : null;
  const screen = (
    <AppHomeScreen
      factoryId={factoryId}
      factoryName={factory.name ?? factoryId}
      logoSrc={logoUrl(factoryId, factory.branding)}
      tiles={tiles}
      staff={staff}
    />
  );
  return ahead ? <HydrationBoundary state={ahead}>{screen}</HydrationBoundary> : screen;
}
