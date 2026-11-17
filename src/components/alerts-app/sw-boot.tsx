'use client';

import { useEffect } from 'react';

import { registerWorker } from '@/lib/alerts-app/push-client';

/** Registers the alerts app's service worker (public/alerts-sw.js) on every page of the app. Renders nothing. */
export function SwBoot() {
  useEffect(() => {
    void registerWorker();
  }, []);
  return null;
}
