'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { InstallGuide } from '@/components/alerts-app/install-guide';
import { LanguageChoice } from '@/components/alerts-app/language-choice';
import { BrandMark } from '@/components/layout/brand-mark';
import { accessHere, rememberAndroidApp } from '@/lib/alerts-app/access-client';
import type { AppAccess } from '@/lib/alerts-app/install';
import { localeChosenHere } from '@/lib/i18n/locale';

const noSubscription = () => () => {};

/**
 * The app opens only where it is the app (lib/alerts-app/install.ts appAccess): from an iPhone's
 * Home Screen, or inside the Android app. Anywhere else the page says how to get it, and nothing of
 * the app loads (no sign-in, no alerts, no service worker). The server cannot tell which it is, so
 * it sends a plain splash and the phone decides as the page starts. In the app, the first question
 * on a phone is its language.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const access = useSyncExternalStore<AppAccess | 'checking'>(noSubscription, accessHere, () => 'checking');

  useEffect(() => {
    if (access === 'open') rememberAndroidApp();
  }, [access]);

  // A browser tab is sent to the app or to Safari: Chrome's own offer to install the page is held back.
  useEffect(() => {
    if (access === 'open' || access === 'checking') return;
    const hold = (event: Event) => event.preventDefault();
    window.addEventListener('beforeinstallprompt', hold);
    return () => window.removeEventListener('beforeinstallprompt', hold);
  }, [access]);

  if (access === 'checking') return <AppSplash />;
  if (access !== 'open') return <InstallGuide access={access} />;
  return <LanguageFirst>{children}</LanguageFirst>;
}

/** The app's first question on this phone, before sign-in: its language (asked once; the cookie keeps it). */
function LanguageFirst({ children }: { children: ReactNode }) {
  const chosenBefore = useSyncExternalStore(noSubscription, localeChosenHere, () => true);
  const [chosenNow, setChosenNow] = useState(false);
  if (!chosenBefore && !chosenNow) return <LanguageChoice onChosen={() => setChosenNow(true)} />;
  return <>{children}</>;
}

/** The brand mark alone, while the phone is looked at. */
export function AppSplash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <BrandMark className="h-12 w-12" />
    </div>
  );
}
