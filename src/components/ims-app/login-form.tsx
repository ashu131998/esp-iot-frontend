'use client';

import { useEffect } from 'react';

import { SignInSteps } from '@/components/auth/sign-in-steps';
import { useRestoreSession } from '@/components/auth/use-restore-session';
import { ImsAppMark } from '@/components/ims-app/app-mark';
import { Card, CardHeader } from '@/components/ui/card';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useT } from '@/lib/i18n/context';

/**
 * Signing in to FloorBeat IMS (ims.floorbeat.in): a work email and a password, the same accounts as
 * the dashboard (components/auth/sign-in-steps.tsx asks which factory when they fit several). Shown at
 * the address asked for (middleware.ts); once signed in that address loads afresh.
 * Shared phones with a 4-digit PIN per worker come with the backend's IMS-device sign-in.
 */
export function ImsLoginForm() {
  const { t } = useT();
  const goOn = () => window.location.replace(window.location.pathname + window.location.search);
  const restoring = useRestoreSession(goOn);

  useEffect(() => {
    fetch('/api/auth/app-login', { credentials: 'same-origin' }).catch(() => {});   // the sign-in's CSRF cookie
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 py-8">
      <Card className="w-full max-w-md p-6">
        <ImsAppMark className="mx-auto mb-4 h-14 w-14" />
        <CardHeader title="FloorBeat IMS" description={t('Your factory\'s stock. Sign in with your work email.')} />
        {restoring ? (
          <p className="mt-6 flex min-h-[16.5rem] items-center justify-center text-sm text-muted" role="status">{t('Signing you in…')}</p>
        ) : (
          <SignInSteps
            onSignedIn={goOn}
            forgot={t('Forgot your password? Your factory admin can set a new one from the Team page of the dashboard.')}
          />
        )}
      </Card>
      <LanguageToggle />
    </div>
  );
}
