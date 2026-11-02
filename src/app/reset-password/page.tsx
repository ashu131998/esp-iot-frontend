import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { staffBaseFrom } from '@/lib/auth-reset';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * The page a reset email opens: /reset-password?token=…[&factory=…] (public; the token is the key).
 * Emails link to the customer host, which has no staff pages: staff links go to STAFF_URL's origin.
 */
export default async function ResetPasswordPage() {
  const { t } = await getT();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">{t('Loading…')}</div>
      }
    >
      <ResetPasswordForm staffBase={staffBaseFrom(process.env.STAFF_URL)} />
    </Suspense>
  );
}
