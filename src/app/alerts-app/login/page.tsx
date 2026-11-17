import { Suspense } from 'react';

import { AppLoginForm } from '@/components/alerts-app/login-form';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AppLoginPage() {
  const { t } = await getT();
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-muted">{t('Loading…')}</div>}>
      <AppLoginForm />
    </Suspense>
  );
}
