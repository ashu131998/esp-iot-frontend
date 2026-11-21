'use client';

import { BellOff } from 'lucide-react';
import Link from 'next/link';

import type { SwitchState } from '@/components/alerts-app/use-push-switch';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/context';

/**
 * On the inbox while this phone will not ring: what is missing and the one tap that fixes it.
 * Signing in does not turn notifications on (a phone only asks after a tap), so without this a
 * person could use the app for weeks and never hear an alert. Nothing once they are on.
 */
export function PushPrompt({
  state,
  busy = false,
  failed = false,
  onEnable,
  installHref,
}: {
  state: SwitchState;
  busy?: boolean;
  failed?: boolean;
  onEnable: () => void;
  installHref: string;
}) {
  const { t } = useT();
  if (state !== 'off' && state !== 'needs-install' && state !== 'blocked' && state !== 'unsupported') return null;
  return (
    <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-amber-900">
        <BellOff className="h-5 w-5 shrink-0" aria-hidden="true" />
        {t('Your phone will not ring yet')}
      </p>
      <p className="mt-1 text-sm text-amber-900/80">
        {state === 'off' && t('Turn on notifications so your phone rings the moment a machine stops.')}
        {state === 'needs-install' && t('Install the app on your Home Screen first, then turn notifications on from here.')}
        {state === 'blocked' && t("Notifications are blocked for this app. Allow them in your phone's settings.")}
        {state === 'unsupported' && t('This browser cannot show notifications. On Android use Chrome; on iPhone add the app to your Home Screen.')}
      </p>
      {state === 'off' && (
        <Button className="mt-3 h-11 w-full text-base" onClick={onEnable} disabled={busy}>
          {busy ? t('Turning on…') : t('Turn on notifications')}
        </Button>
      )}
      {state === 'needs-install' && (
        <Link href={installHref} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-blue-700">
          {t('Install on this phone')}
        </Link>
      )}
      {failed && <p className="mt-2 text-sm text-red-700" role="alert">{t('Could not turn on notifications. Try again.')}</p>}
    </section>
  );
}
