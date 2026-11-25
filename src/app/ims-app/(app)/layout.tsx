import { ImsAppShell } from '@/components/ims-app/shell';
import { getT } from '@/lib/i18n/server';
import { sessionUser } from '@/lib/server/session-user';

/**
 * The signed-in pages (the middleware shows anyone else the sign-in). IMS works on one factory: the
 * session's. Our staff belong to none, so for now they are asked to sign in with a factory's account.
 */
export default async function ImsSignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser();
  if (!user?.factory_id) {
    const { t } = await getT();
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="max-w-sm text-base text-muted">{t('FloorBeat IMS works on one factory\'s stock. Sign in with an account of that factory.')}</p>
      </div>
    );
  }
  return <ImsAppShell factoryName={null}>{children}</ImsAppShell>;
}
