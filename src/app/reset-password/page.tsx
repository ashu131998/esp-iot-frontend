import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** The page a reset email opens: /reset-password?token=… (public; the token is the key). */
export default async function ResetPasswordPage() {
  const { t } = await getT();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">{t('Loading…')}</div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
