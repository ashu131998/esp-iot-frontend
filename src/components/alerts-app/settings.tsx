'use client';

import { useQuery } from '@tanstack/react-query';
import { BatteryCharging, LogOut } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { DowntimeReportsCard } from '@/components/alerts/downtime-reports-card';
import { MobileSettingsCard } from '@/components/alerts/mobile-settings-card';
import { NotificationsCard } from '@/components/alerts-app/notifications-card';
import { RingRulesCard } from '@/components/alerts-app/ring-rules-card';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { alertsApi } from '@/lib/alerts-app/api';
import { PLANTS_QUERY_KEY } from '@/lib/alerts-app/model';
import { callNative, inNativeApp, type NativeHello } from '@/lib/alerts-app/native';
import { forgetThisPhone } from '@/lib/alerts-app/push-client';
import { useAppHref } from '@/lib/alerts-app/queries';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { displayOf, isShown, pageOn } from '@/lib/display';
import { useT } from '@/lib/i18n/context';

const noSubscription = () => () => {};

/**
 * Settings: notifications, the language, the account and sign-out, and what to do when alerts do not arrive. For the
 * factory's admins also the factory's own alert settings and downtime reasons (FactoryAlertSettings).
 */
export function AlertsSettings() {
  const { t } = useT();
  const { user, logout, canWriteFactory } = useAuth();
  const href = useAppHref();
  const plants = useQuery({
    queryKey: PLANTS_QUERY_KEY,
    queryFn: ({ signal }) => alertsApi.plants(signal),
    staleTime: 5 * 60_000,
  });
  const currentId = plants.data?.current ?? user?.factory_id ?? null;
  const factoryName = plants.data?.plants.find((p) => p.factory_id === currentId)?.name ?? currentId;
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await forgetThisPhone();   // the Android app: this phone stops getting this person's alerts
      await logout();
    } finally {
      window.location.href = href('/login');
    }
  }
  const native = useSyncExternalStore(noSubscription, inNativeApp, () => false);

  return (
    <div className="space-y-5">
      <NotificationsCard />
      <RingRulesCard />
      {canWriteFactory && currentId && <FactoryAlertSettings factoryId={currentId} />}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-sm font-semibold text-foreground">{t('Language')}</h2>
        <div className="mt-3">
          <LanguageToggle fill />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-sm font-semibold text-foreground">{t('Account')}</h2>
        {user && <p className="mt-2 text-sm text-foreground">{t('Signed in as {name}', { name: user.email ?? user.username })}</p>}
        {factoryName && <p className="text-sm text-muted">{factoryName}</p>}
        <Button variant="secondary" className="mt-4 w-full gap-2" onClick={signOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {signingOut ? t('Signing out…') : t('Sign out')}
        </Button>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-sm font-semibold text-foreground">{t('Alerts not arriving?')}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>{t('Keep the app on your Home Screen and notifications turned on.')}</li>
          <li>{t('Do not swipe the app away from the recent apps list; let it stay.')}</li>
          <li>{t('Battery saver can delay alerts: allow FloorBeat Alerts to run in the background.')}</li>
        </ul>
        {native && (
          <Button
            variant="secondary"
            className="mt-4 w-full gap-2"
            onClick={() => {
              void callNative<NativeHello>('hello').then((hello) => callNative(hello?.autostart ? 'openAutostartSettings' : 'openBatterySettings'));
            }}
          >
            <BatteryCharging className="h-4 w-4" aria-hidden="true" />
            {t('Open battery settings')}
          </Button>
        )}
      </section>
    </div>
  );
}

/**
 * For the factory's admins: the factory's own alert settings (who gets push alerts and how, the reminders, when a
 * supervisor or the owners are told) and the downtime reasons, here in Alerts and not in the dashboard (the owner,
 * 2026-11-27: "in manage i see alerts setting, i think it should also be there in alerts only"). What our staff
 * switched off for the factory stays off: the Alerts page and each of its two sections (display `alerts`,
 * `alerts.mobile`, `alerts.downtime`), as on the dashboard's Alerts page, which our staff keep.
 */
function FactoryAlertSettings({ factoryId }: { factoryId: string }) {
  const { t } = useT();
  const factory = useQuery({
    queryKey: ['alerts-app-factory', factoryId],
    queryFn: ({ signal }) => api.factory(factoryId, { signal }),
    staleTime: 5 * 60_000,
  });
  if (!factory.data) return null;
  const display = displayOf(factory.data);
  if (!pageOn(display, 'alerts')) return null;
  const mobile = isShown(display, 'alerts.mobile');
  const downtime = isShown(display, 'alerts.downtime');
  if (!mobile && !downtime) return null;
  return (
    <section aria-label={t('Alert settings')} className="space-y-4">
      <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('Alert settings')}</h2>
      {mobile && <MobileSettingsCard factoryId={factoryId} />}
      {downtime && <DowntimeReportsCard factoryId={factoryId} />}
    </section>
  );
}
