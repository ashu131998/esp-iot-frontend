'use client';

import { BatteryCharging } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { AppSplash } from '@/components/alerts-app/app-gate';
import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { BATTERY_DONE_KEY, batteryStepNeeded, callNative, type NativeHello } from '@/lib/alerts-app/native';
import { useT } from '@/lib/i18n/context';

function batteryDoneHere(): boolean {
  try {
    return window.localStorage.getItem(BATTERY_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberBatteryDone() {
  try {
    window.localStorage.setItem(BATTERY_DONE_KEY, '1');
  } catch {
    // storage off: shown again at the next open, nothing worse
  }
}

/**
 * The Android app, once, right after notifications are on: many phones sold in India stop apps in
 * the background to save battery, and then alerts arrive late. The maker's own steps, and a button
 * to the right screen of the phone's settings (lib/alerts-app/native.ts batteryStepNeeded).
 */
export function BatteryFirst({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(batteryDoneHere);
  const [hello, setHello] = useState<NativeHello | null | undefined>(undefined);
  useEffect(() => {
    if (done) return;
    let live = true;
    void callNative<NativeHello>('hello').then((answer) => { if (live) setHello(answer); });
    return () => { live = false; };
  }, [done]);

  if (done) return <>{children}</>;
  if (hello === undefined) return <AppSplash />;
  if (!batteryStepNeeded(hello, done)) return <>{children}</>;
  return (
    <BatteryStep
      maker={hello?.maker ?? 'other'}
      onOpen={() => void callNative(hello?.autostart ? 'openAutostartSettings' : 'openBatterySettings')}
      onDone={() => {
        rememberBatteryDone();
        setDone(true);
      }}
    />
  );
}

/** The maker's steps, in the person's language. */
function useMakerSteps(maker: string): string[] {
  const { t } = useT();
  const open = t('Tap “Open settings” below.');
  switch (maker) {
    case 'xiaomi':
      return [open, t('Turn on “Autostart” for FloorBeat Alerts.'), t('Then, in “Battery saver”, choose “No restrictions”.')];
    case 'vivo':
      return [open, t('Allow FloorBeat Alerts to start in the background.'), t('In “Battery”, allow FloorBeat Alerts high background power use.')];
    case 'oppo':
    case 'realme':
    case 'oneplus':
      return [open, t('Turn on “Auto launch” for FloorBeat Alerts.'), t('In “Battery usage”, turn on “Allow background activity”.')];
    case 'samsung':
      return [open, t('Open “Battery” and choose “Unrestricted”.'), t('Make sure FloorBeat Alerts is not in the “Sleeping apps” list.')];
    case 'huawei':
      return [open, t('In “App launch”, set FloorBeat Alerts to “Manage manually” and turn on all three switches.')];
    default:
      return [open, t('Open “Battery” and choose “Unrestricted” (or “Don’t optimise”).')];
  }
}

export function BatteryStep({ maker, onOpen, onDone }: { maker: string; onOpen: () => void; onDone: () => void }) {
  const { t } = useT();
  const steps = useMakerSteps(maker);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <BrandMark className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Keep alerts on time')}</h1>
          <p className="text-sm text-muted">
            {t('Some phones stop apps in the background to save battery, and then alerts come late. Let FloorBeat Alerts run in the background:')}
          </p>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BatteryCharging className="h-4 w-4" aria-hidden="true" />
          {t('Battery')}
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
          {steps.map((line) => <li key={line}>{line}</li>)}
        </ol>
        <Button className="mt-4 h-11 w-full text-base" onClick={onOpen}>{t('Open settings')}</Button>
        <Button variant="secondary" className="mt-2 h-11 w-full text-base" onClick={onDone}>{t('Done')}</Button>
      </section>

      <div className="flex justify-end">
        <LanguageToggle compact />
      </div>
    </div>
  );
}
