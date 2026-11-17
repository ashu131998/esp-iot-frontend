'use client';

import { CheckCircle2, ChevronRight, Share, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { isIOS, isIOSSafari, platformOf, type Platform } from '@/lib/alerts-app/install';
import { standaloneHere } from '@/lib/alerts-app/push-client';
import { useAppHref } from '@/lib/alerts-app/queries';
import { useT } from '@/lib/i18n/context';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * How to put the app on the phone's Home Screen, for this phone: Safari's Share → Add to Home
 * Screen on an iPhone, Chrome's Install on Android (the button itself when Chrome offers it).
 * `platform` forces one (tests); otherwise the phone decides.
 */
const noSubscription = () => () => {};

/** The browser's user agent once on the phone; null on the server (the page then shows both phones' steps). */
function useUserAgent(): string | null {
  return useSyncExternalStore(noSubscription, () => navigator.userAgent, () => null);
}

export function InstallGuide({ platform: forced }: { platform?: Platform }) {
  const { t } = useT();
  const href = useAppHref();
  const ua = useUserAgent();
  const platform: Platform = forced ?? (ua ? platformOf(ua) : 'other');
  const iosOtherBrowser = Boolean(ua) && isIOS(ua) && !isIOSSafari(ua);
  const standalone = useSyncExternalStore(noSubscription, standaloneHere, () => false);
  const [justInstalled, setJustInstalled] = useState(false);
  const installed = standalone || justInstalled;
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setJustInstalled(true);
    setPrompt(null);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <BrandMark className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Install FloorBeat Alerts')}</h1>
          <p className="text-sm text-muted">{t('Put the app on your Home Screen so alerts ring like a call, even when the app is closed.')}</p>
        </div>
      </div>

      {installed ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {t('Installed. Open it from your Home Screen.')}
          </p>
          <Link href={href('/settings')} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t('Turn on notifications')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          {(platform === 'ios' || platform === 'other') && (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                {t('On iPhone')}
              </h2>
              {iosOtherBrowser && <p className="mt-2 text-sm text-amber-700">{t('Open this page in Safari to install.')}</p>}
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
                <li>
                  {t('Tap the Share button at the bottom of Safari.')}
                  <Share className="ml-1.5 inline h-4 w-4 align-text-bottom text-primary" aria-hidden="true" />
                </li>
                <li>{t('Choose “Add to Home Screen”, then “Add”.')}</li>
                <li>{t('Open FloorBeat Alerts from your Home Screen, sign in and turn notifications on.')}</li>
              </ol>
            </section>
          )}
          {(platform === 'android' || platform === 'other') && (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                {t('On Android')}
              </h2>
              {prompt && (
                <Button className="mt-3 w-full" onClick={install}>{t('Install')}</Button>
              )}
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
                <li>{t('Tap “Install”, or open the Chrome menu (⋮) and choose “Add to Home screen”.')}</li>
                <li>{t('Open FloorBeat Alerts from your Home Screen and turn notifications on.')}</li>
              </ol>
            </section>
          )}
        </>
      )}

      <div className="flex items-center justify-between">
        <Link href={href('/')} className="text-sm font-medium text-primary hover:underline">{t('Open the app')}</Link>
        <LanguageToggle compact />
      </div>
    </div>
  );
}
