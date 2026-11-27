import { notFound, redirect } from 'next/navigation';

import { AppHomeScreen } from '@/components/dashboard-app/home-screen';
import { appTiles, homeTarget } from '@/lib/dashboard-app';
import { logoUrl } from '@/lib/branding';
import { displayOf } from '@/lib/display';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

/**
 * The FloorBeat app's home screen (its root, dashboard.floorbeat.in/: the middleware serves it here for the
 * factory the person is signed in at): a tile for each of the person's apps (lib/dashboard-app.ts appTiles), the
 * same in the phone app, the iPhone's Home Screen app and a computer's browser. With one app only, it opens that.
 */
export default async function AppHomePage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  const factory = await serverApi.factory(factoryId).catch(() => null);
  if (!factory) notFound();
  const tiles = appTiles(displayOf(factory));
  const only = homeTarget(tiles);
  if (only) redirect(only);
  return (
    <AppHomeScreen
      factoryId={factoryId}
      factoryName={factory.name ?? factoryId}
      logoSrc={logoUrl(factoryId, factory.branding)}
      tiles={tiles}
    />
  );
}
