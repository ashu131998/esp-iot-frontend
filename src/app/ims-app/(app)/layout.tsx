import { headers } from 'next/headers';

import { ImsCannotConnect } from '@/components/ims-app/cannot-connect';
import { ImsSignOut } from '@/components/ims-app/sign-out';
import { ImsAppShell } from '@/components/ims-app/shell';
import { staffAppsHref } from '@/lib/dashboard-app';
import { getT } from '@/lib/i18n/server';
import { inFloorBeatApp } from '@/lib/server/floorbeat-app';
import { requireFactoryPage } from '@/lib/server/page-guard';
import { sessionUser } from '@/lib/server/session-user';
import { STAFF_FACTORY_HEADER, imsFactoryOf } from '@/lib/staff-factory';

/**
 * The signed-in pages (the middleware shows anyone else the sign-in). IMS works on one factory: the
 * session's. Our staff belong to none, so here they are asked to sign in with a factory's account
 * (and can sign out to do so).
 *
 * In the FloorBeat app (dashboard.floorbeat.in/ims) they are its Stock, an app of its own beside the dashboard
 * (the owner, 2026-11-27), there only for a factory our staff switched the IMS on for, as its home-screen tile is.
 * Our staff open a factory's Stock there at its long address (/factories/<id>/ims/…): the middleware names the
 * factory (lib/staff-factory.ts), and its Home goes back to that factory's apps.
 */
export default async function ImsSignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser();
  // Not told (the API not answering): say so, never "an account without a factory".
  if (user === undefined) return <ImsCannotConnect />;
  const factoryId = imsFactoryOf(user, (await headers()).get(STAFF_FACTORY_HEADER));
  if (!factoryId) {
    const { t } = await getT();
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-base text-muted">{t('FloorBeat IMS works on one factory\'s stock. Sign in with an account of that factory.')}</p>
        <ImsSignOut withText className="ring-1 ring-slate-300" />
      </div>
    );
  }
  const inFloorBeat = await inFloorBeatApp();
  if (inFloorBeat) await requireFactoryPage(factoryId, 'ims');
  // our staff, at the factory's long address
  const forStaff = inFloorBeat && !user?.factory_id;
  return (
    <ImsAppShell
      factoryId={factoryId}
      factoryName={null}
      inFloorBeat={inFloorBeat}
      base={forStaff ? `/factories/${encodeURIComponent(factoryId)}/ims` : undefined}
      home={forStaff ? staffAppsHref(factoryId) : undefined}
    >
      {children}
    </ImsAppShell>
  );
}
