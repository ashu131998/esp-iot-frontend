'use client';

import { useEffect } from 'react';

import { registerWorker, tellWorkerLocale } from '@/lib/alerts-app/push-client';
import { useLocale } from '@/lib/i18n/context';

/**
 * Registers the alerts app's service worker (public/alerts-sw.js) on every page of the app and
 * tells it the person's language, so a push rings in Hindi or Gujarati. Renders nothing.
 */
export function SwBoot() {
  const locale = useLocale();
  useEffect(() => {
    void registerWorker().then(() => tellWorkerLocale(locale));
  }, [locale]);
  return null;
}
