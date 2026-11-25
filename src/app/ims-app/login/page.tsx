import { Suspense } from 'react';

import { ImsLoginForm } from '@/components/ims-app/login-form';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** FloorBeat IMS's sign-in: shown in place at whatever address was asked for, signed out (middleware.ts). */
export default async function ImsLoginPage() {
  const { t } = await getT();
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-muted">{t('Loading…')}</div>}>
      <ImsLoginForm />
    </Suspense>
  );
}
