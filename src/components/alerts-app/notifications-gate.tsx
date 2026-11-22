'use client';

import { BellRing } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { AppSplash } from '@/components/alerts-app/app-gate';
import { BatteryFirst } from '@/components/alerts-app/battery-step';
import { usePushSwitch } from '@/components/alerts-app/use-push-switch';
import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { phoneHere, type Phone } from '@/lib/alerts-app/access-client';
import { callNative, inNativeApp, onNativeEvent } from '@/lib/alerts-app/native';
import { notificationsStep, type NotificationsStep } from '@/lib/alerts-app/push';
import { subscribedHere } from '@/lib/alerts-app/push-client';
import { useT } from '@/lib/i18n/context';

const noSubscription = () => () => {};

/** The phone the app runs on; null on a computer (and on the server). */
export function usePhone(): Phone | null {
  return useSyncExternalStore(noSubscription, phoneHere, () => null);
}

/** Whether the app needs notifications on to open here: on a phone. */
export function useNotificationsRequired(): boolean {
  return usePhone() !== null;
}

/**
 * On a phone (the iPhone's Home Screen app, the Android app: the same screens) the signed-in app
 * opens only once the phone rings (lib/alerts-app/push.ts notificationsStep); until then it shows
 * how to turn notifications on. It comes right after sign-in: the phone is registered for that
 * person's alerts.
 */
export function NotificationsGate({ children }: { children: ReactNode }) {
  const phone = usePhone();
  return phone ? <RingFirst phone={phone}>{children}</RingFirst> : <>{children}</>;
}

function RingFirst({ phone, children }: { phone: Phone; children: ReactNode }) {
  const push = usePushSwitch();
  const { recheck } = push;
  const native = useSyncExternalStore(noSubscription, inNativeApp, () => false);
  // The phone's own answer, without the server: a phone already set up opens at once.
  const [ringing, setRinging] = useState<boolean | null>(null);

  useEffect(() => {
    const look = () => {
      void subscribedHere().then(setRinging);
    };
    look();
    // Back from the phone's Settings (allowed there, or turned off): look again.
    const again = () => {
      look();
      recheck();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') again();
    };
    document.addEventListener('visibilitychange', onVisible);
    // The Android app says so itself when notifications switch (its own question answered, Settings left).
    const stopNative = onNativeEvent((event) => {
      if (event === 'notifications') again();
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      stopNative();
    };
  }, [recheck]);

  const step = notificationsStep(ringing ? 'on' : push.state);
  if (step === 'app') return native ? <BatteryFirst>{children}</BatteryFirst> : <>{children}</>;
  if (step === 'checking') return <AppSplash />;
  return (
    <NotificationsStepScreen
      step={step}
      phone={phone}
      busy={push.busy}
      failed={push.note === 'enable-failed'}
      onEnable={push.enable}
      onCheck={() => {
        void subscribedHere().then(setRinging);
        recheck();
      }}
      onOpenSettings={native ? () => void callNative('openNotificationSettings') : undefined}
    />
  );
}

/** What to do on this phone: the tap and "Allow"; the way back when it blocked them; a phone too old for them. */
export function NotificationsStepScreen({
  step,
  phone,
  busy = false,
  failed = false,
  onEnable,
  onCheck,
  onOpenSettings,
}: {
  step: Exclude<NotificationsStep, 'app' | 'checking'>;
  phone: Phone;
  busy?: boolean;
  failed?: boolean;
  onEnable: () => void;
  onCheck: () => void;
  /** The Android app: straight to its notification settings. */
  onOpenSettings?: () => void;
}) {
  const { t } = useT();
  const iphone = phone === 'iphone';
  const view = {
    'turn-on': {
      title: t('Turn on notifications'),
      lead: t('FloorBeat Alerts works only with notifications on, so your phone rings the moment a machine stops.'),
      steps: [t('Tap “Turn on notifications” below.'), t('When your phone asks, tap “Allow”.')],
    },
    blocked: {
      title: t('Notifications are blocked'),
      lead: t('FloorBeat Alerts works only with notifications on. Allow them in your phone’s Settings:'),
      steps: iphone
        ? [
          t('Open the Settings app on your iPhone.'),
          t('Tap “Notifications”, then “FloorBeat Alerts”.'),
          t('Turn on “Allow Notifications”.'),
          t('Come back here and tap “Turn on notifications”.'),
        ]
        : [
          t('Open your phone’s Settings, then “Apps”, then “FloorBeat Alerts”.'),
          t('Tap “Notifications” and turn them on.'),
          t('Come back here and tap “Turn on notifications”.'),
        ],
    },
    update: iphone
      ? {
        title: t('Update your iPhone'),
        lead: t('FloorBeat Alerts needs notifications, and an iPhone gives them to Home Screen apps from iOS 16.4.'),
        steps: [
          t('Open Settings, then General, then Software Update, and install the update.'),
          t('Then open FloorBeat Alerts again from your Home Screen.'),
        ],
      }
      : {
        title: t('Update Chrome'),
        lead: t('FloorBeat Alerts needs notifications, and this phone’s browser cannot give them yet.'),
        steps: [t('Open the Play Store and update Chrome.'), t('Then open FloorBeat Alerts again.')],
      },
  }[step];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <BrandMark className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{view.title}</h1>
          <p className="text-sm text-muted">{view.lead}</p>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BellRing className="h-4 w-4" aria-hidden="true" />
          {t('Notifications')}
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
          {view.steps.map((line) => <li key={line}>{line}</li>)}
        </ol>
        {step === 'turn-on' && (
          <Button className="mt-4 h-11 w-full text-base" onClick={onEnable} disabled={busy}>
            {busy ? t('Turning on…') : t('Turn on notifications')}
          </Button>
        )}
        {step === 'blocked' && onOpenSettings && (
          <Button className="mt-4 h-11 w-full text-base" onClick={onOpenSettings}>{t('Open settings')}</Button>
        )}
        {step === 'blocked' && (
          <Button variant="secondary" className={onOpenSettings ? 'mt-2 h-11 w-full text-base' : 'mt-4 h-11 w-full text-base'} onClick={onCheck}>{t('Check again')}</Button>
        )}
        {failed && <p className="mt-2 text-sm text-red-700" role="alert">{t('Could not turn on notifications. Try again.')}</p>}
      </section>

      <div className="flex justify-end">
        <LanguageToggle compact />
      </div>
    </div>
  );
}
