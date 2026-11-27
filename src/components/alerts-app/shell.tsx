'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BellRing, LayoutGrid, Settings as SettingsIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { AlertDetail } from '@/components/alerts-app/alert-detail';
import { AlertsInbox } from '@/components/alerts-app/inbox';
import { AlertsSettings } from '@/components/alerts-app/settings';
import { InboxSkeleton } from '@/components/alerts-app/skeletons';
import { BrandMark } from '@/components/layout/brand-mark';
import { AppLink } from '@/components/ui/app-link';
import { ALERTS_QUERY_KEY, appBase, appPageOf, appPath, tabActive } from '@/lib/alerts-app/model';
import { followAlerts, keepSubscriptionFresh, setBadge } from '@/lib/alerts-app/push-client';
import { useAppHref, useMyAlerts } from '@/lib/alerts-app/queries';
import { APP_HOME } from '@/lib/dashboard-app';
import { useT } from '@/lib/i18n/context';
import { PageSwap, PageSwapScope, useNavigate } from '@/lib/navigation-context';
import { cn } from '@/lib/utils';

/**
 * The signed-in app's frame: a slim top bar with the unread count, the page, and a bottom bar with
 * Inbox and Settings. It also keeps the inbox fresh (a push arriving while the app is open refreshes
 * it), opens the alert of a tapped notification, keeps this phone's push subscription current, and
 * puts the unread count on the app icon.
 *
 * A tap on a row or a tab draws the page asked for on the same frame (PageAhead below): each of the
 * app's pages is one component fed by what the phone already holds, so nothing has to come back from
 * the server first, and no page is fetched before it is asked for.
 */
export function AlertsAppShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const navigate = useNavigate();
  const href = useAppHref();
  const queryClient = useQueryClient();
  const alerts = useMyAlerts();
  const unread = alerts.data?.unread ?? 0;
  // inside the FloorBeat app (/inbox): its Alerts, with the way back to the app's home screen
  const inFloorBeat = appBase(pathname) === '/inbox';

  // A push refreshes the inbox; a tapped notification opens its alert, whatever the phone did with
  // the tap (lib/alerts-app/open.ts).
  useEffect(() => followAlerts({
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['me-alert'] });
    },
    go: (url) => navigate(href(url)),
    here: () => `${appPath(window.location.pathname)}${window.location.search}`,
  }), [queryClient, navigate, href]);

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
    <PageSwapScope>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
            {inFloorBeat ? (
              <AppLink href={APP_HOME} aria-label={t('Home')} className="-ml-2 grid h-10 w-10 place-items-center rounded-xl text-foreground hover:bg-slate-100">
                <LayoutGrid className="h-5 w-5" aria-hidden />
              </AppLink>
            ) : (
              <BrandMark className="h-8 w-8" />
            )}
            <p className="text-base font-semibold text-foreground">{inFloorBeat ? t('Alerts') : t('FloorBeat Alerts')}</p>
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white" aria-label={t('{count} unread', { count: unread })}>
                {unread}
              </span>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">
          <PageSwap skeleton={<InboxSkeleton />} ahead={(path) => <PageAhead path={path} />}>{children}</PageSwap>
        </main>

        <nav aria-label={t('Main pages')} className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto flex max-w-lg">
            {tabs.map(({ key, href: to, label, Icon }) => {
              const active = tabActive(key, pathname);
              return (
                <li key={key} className="min-w-0 flex-1">
                  <AppLink
                    href={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-primary' : 'text-muted')}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                      {key === 'inbox' && unread > 0 && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
                    </span>
                    <span className="max-w-full truncate px-1">{label}</span>
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </PageSwapScope>
  );
}

/** The page at `path`, drawn at once while the app moves there; the skeleton for an address that is none of them. */
function PageAhead({ path }: { path: string }) {
  const page = appPageOf(path);
  if (page?.page === 'inbox') return <AlertsInbox />;
  if (page?.page === 'settings') return <AlertsSettings />;
  if (page?.page === 'alert') return <AlertDetail id={page.id} />;
  return <InboxSkeleton />;
}
