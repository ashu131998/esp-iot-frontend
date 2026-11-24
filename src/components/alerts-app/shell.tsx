'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BellRing, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { ALERTS_QUERY_KEY, appPath, tabActive } from '@/lib/alerts-app/model';
import { followAlerts, keepSubscriptionFresh, setBadge } from '@/lib/alerts-app/push-client';
import { useAppHref, useMyAlerts } from '@/lib/alerts-app/queries';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/**
 * The signed-in app's frame: a slim top bar with the unread count, the page, and a bottom bar with
 * Inbox and Settings. It also keeps the inbox fresh (a push arriving while the app is open refreshes
 * it), opens the alert of a tapped notification, keeps this phone's push subscription current, and
 * puts the unread count on the app icon.
 */
export function AlertsAppShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const href = useAppHref();
  const queryClient = useQueryClient();
  const alerts = useMyAlerts();
  const unread = alerts.data?.unread ?? 0;

  // A push refreshes the inbox; a tapped notification opens its alert, whatever the phone did with
  // the tap (lib/alerts-app/open.ts).
  useEffect(() => followAlerts({
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['me-alert'] });
    },
    go: (url) => router.push(href(url)),
    here: () => `${appPath(window.location.pathname)}${window.location.search}`,
  }), [queryClient, router, href]);

  useEffect(() => {
    void keepSubscriptionFresh();
  }, []);

  useEffect(() => {
    setBadge(unread);
  }, [unread]);

  const tabs = [
    { key: 'inbox' as const, href: href('/'), label: t('Inbox'), Icon: BellRing },
    { key: 'settings' as const, href: href('/settings'), label: t('Settings'), Icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <BrandMark className="h-8 w-8" />
          <p className="text-base font-semibold text-foreground">{t('FloorBeat Alerts')}</p>
          {unread > 0 && (
            <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white" aria-label={t('{count} unread', { count: unread })}>
              {unread}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav aria-label={t('Main pages')} className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {tabs.map(({ key, href: to, label, Icon }) => {
            const active = tabActive(key, pathname);
            return (
              <li key={key} className="min-w-0 flex-1">
                <Link
                  href={to}
                  prefetch   // the whole page fetched ahead: a tap on the tab shows it at once
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-primary' : 'text-muted')}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {key === 'inbox' && unread > 0 && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
                  </span>
                  <span className="max-w-full truncate px-1">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
