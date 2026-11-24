'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { SignInSteps } from '@/components/auth/sign-in-steps';
import { useRestoreSession } from '@/components/auth/use-restore-session';
import { DashboardAppMark } from '@/components/dashboard-app/app-mark';
import { Card, CardHeader } from '@/components/ui/card';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { safeNextPath } from '@/lib/auth-redirect';
import { afterDashboardSignIn } from '@/lib/dashboard-app';
import { useT } from '@/lib/i18n/context';

/**
 * Signing in to the FloorBeat app (dashboard.floorbeat.in): a work email and a password, no factory
 * to type; when they sign in at several factories, a next step asks which
 * (components/auth/sign-in-steps.tsx). It is shown at the address asked for (middleware.ts), and once
 * signed in that address loads afresh as the person's own factory.
 */
export function DashboardLoginForm() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const goOn = () => window.location.replace(afterDashboardSignIn(next, window.location.pathname + window.location.search));
  const restoring = useRestoreSession(goOn);

  useEffect(() => {
    fetch('/api/auth/app-login', { credentials: 'same-origin' }).catch(() => {});   // the sign-in's CSRF cookie
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 py-8">
      <Card className="w-full max-w-md p-6">
        <DashboardAppMark className="mx-auto mb-4 h-14 w-14" />
        <CardHeader title="FloorBeat" description={t('Your factory\'s dashboard. Sign in with your work email.')} />
        {restoring ? (
          // as tall as the form that may follow: nothing jumps when it shows
          <p className="mt-6 flex min-h-[16.5rem] items-center justify-center text-sm text-muted" role="status">{t('Signing you in…')}</p>
        ) : (
          <SignInSteps
            onSignedIn={goOn}
            forgot={t('Forgot your password? Your factory admin can set a new one from the Team page of the dashboard.')}
          />
        )}
      </Card>
      <LanguageToggle />
      <p className="text-xs text-muted">
        <a href="https://floorbeat.in/privacy" className="hover:text-primary hover:underline">{t('Privacy')}</a>
        <span aria-hidden="true"> · </span>
        <a href="https://floorbeat.in/terms" className="hover:text-primary hover:underline">{t('Terms')}</a>
      </p>
    </div>
  );
}
