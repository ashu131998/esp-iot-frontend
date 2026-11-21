'use client';

import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { NotificationsCard } from '@/components/alerts-app/notifications-card';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { alertsApi } from '@/lib/alerts-app/api';
import { PLANTS_QUERY_KEY } from '@/lib/alerts-app/model';
import { useAppHref } from '@/lib/alerts-app/queries';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/context';

/** Settings: notifications, the language, the account and sign-out, and what to do when alerts do not arrive. */
export function AlertsSettings() {
  const { t } = useT();
  const { user, logout } = useAuth();
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
      await logout();
    } finally {
      window.location.href = href('/login');
    }
  }

  return (
    <div className="space-y-5">
      <NotificationsCard />

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
      </section>
    </div>
  );
}
