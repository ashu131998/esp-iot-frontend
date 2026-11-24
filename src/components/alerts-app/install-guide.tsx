'use client';

import { CheckCircle2, ChevronRight, Download, Share, Smartphone } from 'lucide-react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { ANDROID_APK_URL, APP_PAGE_URL, type AppAccess } from '@/lib/alerts-app/install';
import { useAppHref } from '@/lib/alerts-app/queries';
import { useT } from '@/lib/i18n/context';

const noSubscription = () => () => {};

/** The app's address as this phone reached it ("alerts.floorbeat.in"). */
function useAddress(): string {
  return useSyncExternalStore(noSubscription, () => window.location.host, () => 'alerts.floorbeat.in');
}

/**
 * What the app's address shows where the app does not open (components/alerts-app/app-gate.tsx):
 * the iPhone's steps to the Home Screen (Safari first, from any other browser), the Android
 * download, or both on a computer. Inside the app (its /install page) it says the app is installed.
 */
export function InstallGuide({ access }: { access: AppAccess }) {
  const { t } = useT();
  const href = useAppHref();
  const address = useAddress();

  const header = access === 'get-android-app'
    ? { title: t('Get the FloorBeat Alerts app'), lead: t('On Android, alerts come in the FloorBeat Alerts app, not in the browser.') }
    : access === 'phone-only'
      ? { title: t('FloorBeat Alerts is a phone app'), lead: t('Open it on your phone. On a computer, use the FloorBeat dashboard.') }
      : { title: t('Install FloorBeat Alerts'), lead: t('Put the app on your Home Screen so alerts ring like a call, even when the app is closed.') };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <BrandMark className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{header.title}</h1>
          <p className="text-sm text-muted">{header.lead}</p>
        </div>
      </div>

      {access === 'open' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {t('Installed. Open it from your Home Screen.')}
          </p>
          <AppLink href={href('/settings')} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t('Turn on notifications')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </AppLink>
        </section>
      )}

      {(access === 'add-to-home' || access === 'use-safari') && <IPhoneSteps inSafari={access === 'add-to-home'} address={address} />}

      {access === 'get-android-app' && <AndroidDownload />}

      {access === 'phone-only' && (
        <>
          <Card title={t('On iPhone')}>
            <p className="mt-2 text-sm text-foreground">{t('On your iPhone, open {address} in Safari, then tap Share and “Add to Home Screen”.', { address })}</p>
          </Card>
          <Card title={t('On Android')}>
            <p className="mt-2 text-sm text-foreground">{t('On your Android phone, open floorbeat.in/app and download the app.')}</p>
          </Card>
        </>
      )}

      <div className="flex items-center justify-between">
        {access === 'open' ? <AppLink href={href('/')} className="text-sm font-medium text-primary hover:underline">{t('Open the app')}</AppLink> : <span />}
        <LanguageToggle compact />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Safari's Share → Add to Home Screen; from another browser, the link to take to Safari first. */
function IPhoneSteps({ inSafari, address }: { inSafari: boolean; address: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${address}`);
      setCopied(true);
    } catch {
      // no clipboard here: the address is on the screen to type
    }
  }

  return (
    <Card title={t('On iPhone')}>
      {!inSafari && (
        <>
          <p className="mt-2 text-sm font-medium text-amber-700">{t('Open this page in Safari to install.')}</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 py-1.5 pl-3 pr-1.5 ring-1 ring-gray-200">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{address}</span>
            <Button variant="secondary" size="sm" onClick={copy}>{copied ? t('Copied') : t('Copy link')}</Button>
          </div>
        </>
      )}
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
        {!inSafari && <li>{t('Copy the link, open Safari and paste it in the address bar.')}</li>}
        <li>
          {t('Tap the Share button at the bottom of Safari.')}
          <Share className="ml-1.5 inline h-4 w-4 align-text-bottom text-primary" aria-hidden="true" />
        </li>
        <li>{t('Choose “Add to Home Screen”, then “Add”.')}</li>
        <li>{t('Open FloorBeat Alerts from your Home Screen, sign in and turn notifications on.')}</li>
      </ol>
      {inSafari && <p className="mt-3 text-xs text-muted">{t('No “Add to Home Screen” in the list? Open this page in the Safari app.')}</p>}
    </Card>
  );
}

/** The APK from floorbeat.in, and how to install it. */
function AndroidDownload() {
  const { t } = useT();
  return (
    <Card title={t('On Android')}>
      <a
        href={ANDROID_APK_URL}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-blue-700"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t('Download for Android')}
      </a>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
        <li>{t('Open the downloaded file. If the phone asks, allow installs from your browser for this one app.')}</li>
        <li>{t('Open FloorBeat Alerts from your apps, sign in and turn notifications on.')}</li>
      </ol>
      <p className="mt-3 text-sm text-muted">{t('Already installed? Open FloorBeat Alerts from your apps.')}</p>
      <a href={`${APP_PAGE_URL}#android`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {t('Help with installing')}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </Card>
  );
}
