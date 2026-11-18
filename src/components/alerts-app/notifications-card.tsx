'use client';

import Link from 'next/link';

import { usePushSwitch, type SwitchState } from '@/components/alerts-app/use-push-switch';
import { Button } from '@/components/ui/button';
import { TONE_DOT, type Tone } from '@/components/ui/simple';
import { useAppHref } from '@/lib/alerts-app/queries';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/**
 * The notifications switch: on, off, blocked by the phone, or not possible here (an iPhone
 * before the app is on the Home Screen), with a test push once on.
 */
export function NotificationsCard() {
  const { t } = useT();
  const href = useAppHref();
  const { state, busy, note, enable, disable, test } = usePushSwitch();

  const lines: Record<SwitchState, string> = {
    checking: t('Checking…'),
    on: t('Notifications are on for this phone.'),
    off: t('Notifications are off. Turn them on so your phone rings when a machine stops.'),
    blocked: t("Notifications are blocked for this app. Allow them in your phone's settings."),
    'needs-install': t('Install the app on your Home Screen first, then turn notifications on from here.'),
    unsupported: t('This browser cannot show notifications. On Android use Chrome; on iPhone add the app to your Home Screen.'),
    'server-off': t('Notifications are not set up on the server yet.'),
    ok: t('Checking…'),
  };
  const tone: Tone = state === 'on' ? 'good' : state === 'checking' || state === 'ok' ? 'idle' : state === 'off' || state === 'needs-install' ? 'warn' : 'bad';

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className={cn('h-2.5 w-2.5 rounded-full', TONE_DOT[tone])} />
        {t('Notifications')}
      </h2>
      <p className="mt-2 text-sm text-muted">{lines[state]}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {state === 'off' && (
          <Button onClick={enable} disabled={busy}>{busy ? t('Turning on…') : t('Turn on notifications')}</Button>
        )}
        {state === 'on' && (
          <>
            <Button variant="secondary" onClick={test} disabled={busy}>{t('Send a test')}</Button>
            <Button variant="ghost" onClick={disable} disabled={busy}>{t('Turn off on this phone')}</Button>
          </>
        )}
        {state === 'needs-install' && (
          <Link href={href('/install')} className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
            {t('Install on this phone')}
          </Link>
        )}
      </div>
      {note && (
        <p className="mt-3 text-sm text-muted" role="status">
          {note === 'enable-failed' && t('Could not turn on notifications. Try again.')}
          {note === 'test-sent' && t('Test sent. It should ring in a few seconds.')}
          {note === 'test-failed' && t('The test could not be sent.')}
        </p>
      )}
    </section>
  );
}
