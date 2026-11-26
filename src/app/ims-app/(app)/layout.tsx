import { ImsCannotConnect } from '@/components/ims-app/cannot-connect';
import { ImsSignOut } from '@/components/ims-app/sign-out';
import { ImsAppShell } from '@/components/ims-app/shell';
import { getT } from '@/lib/i18n/server';
import { sessionUser } from '@/lib/server/session-user';

/**
 * The signed-in pages (the middleware shows anyone else the sign-in). IMS works on one factory: the
 * session's. Our staff belong to none, so for now they are asked to sign in with a factory's account
 * (and can sign out to do so).
 */
export default async function ImsSignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser();
  // Not told (the API not answering): say so, never "an account without a factory".
  if (user === undefined) return <ImsCannotConnect />;
  if (!user?.factory_id) {
    const { t } = await getT();
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-base text-muted">{t('FloorBeat IMS works on one factory\'s stock. Sign in with an account of that factory.')}</p>
        <ImsSignOut withText className="ring-1 ring-slate-300" />
      </div>
    );
  }
  return <ImsAppShell factoryId={user.factory_id} factoryName={null}>{children}</ImsAppShell>;
}
