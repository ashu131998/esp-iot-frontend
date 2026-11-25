'use client';

import { useT } from '@/lib/i18n/context';

/**
 * Who is signed in could not be told (the API not answering: a deploy, the network): said as it is, with
 * a way to try again, never mistaken for an account without a factory.
 */
export function ImsCannotConnect() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="max-w-sm text-base text-foreground">{t('Could not reach FloorBeat. Check the connection and try again.')}</p>
      <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-2xl px-5 font-medium text-primary ring-1 ring-slate-300">
        {t('Try again')}
      </button>
    </div>
  );
}
