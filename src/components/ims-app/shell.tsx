'use client';

import { Boxes, House, LayoutGrid, PackagePlus } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { ImsAppMark } from '@/components/ims-app/app-mark';
import { ImsLinksProvider } from '@/components/ims-app/ims-links';
import { ImsQueueBar } from '@/components/ims-app/queue-bar';
import { ImsQueueProvider } from '@/components/ims-app/queue-context';
import { ImsSignOut } from '@/components/ims-app/sign-out';
import { AppLink } from '@/components/ui/app-link';
import { APP_HOME } from '@/lib/dashboard-app';
import { useT } from '@/lib/i18n/context';
import { imsHref } from '@/lib/ims/tab';
import { cn } from '@/lib/utils';

/** Where the stock's screens are inside the FloorBeat app (dashboard.floorbeat.in/ims/stock…). */
export const IMS_IN_APP = '/ims';

/**
 * The page a bottom-bar tab stands for (plain addresses: /, /stock…), served from /ims-app/… inside; in the
 * FloorBeat app the same under /ims.
 */
export function imsTabActive(tab: '/' | '/add' | '/stock', pathname: string): boolean {
  const path = pathname.replace(/^\/(ims-app|ims)(?=\/|$)/, '') || '/';
  return tab === '/' ? path === '/' : path === tab || path.startsWith(`${tab}/`);
}

/**
 * The signed-in app's frame: a slim top bar (with Sign out), what waits on the phone to be sent (on every
 * tab: sending goes on whichever is open), and a bottom bar with big tabs. Count and the rest join the
 * bar as their screens are built.
 *
 * In the FloorBeat app (`inFloorBeat`) it is that app's Stock, looking like an app of its own beside the
 * dashboard, as its Alerts do (the owner, 2026-11-27: "similar to alerts, stock ims should also have separate
 * looking app, not inside dashboard"): the way back to the app's home screen and "Stock" on top, Add item and
 * Available stock below (the home screen is where the apps are picked: no home of its own), its screens under
 * /ims. Signing out is on the home screen there.
 */
export function ImsAppShell({
  factoryId,
  factoryName,
  inFloorBeat = false,
  children,
}: {
  factoryId: string;
  factoryName: string | null;
  inFloorBeat?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const base = inFloorBeat ? IMS_IN_APP : '';
  const tabs = [
    ...(inFloorBeat ? [] : [{ to: '/' as const, label: t('Home'), Icon: House }]),
    { to: '/add' as const, label: t('Add item'), Icon: PackagePlus },
    { to: '/stock' as const, label: t('Available stock'), Icon: Boxes },
  ];

  return (
    <ImsQueueProvider factoryId={factoryId}>
      <ImsLinksProvider base={base}>
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-30 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
              {inFloorBeat ? (
                <AppLink href={APP_HOME} aria-label={t('Home')} className="-ml-2 grid h-10 w-10 place-items-center rounded-xl text-foreground hover:bg-slate-100">
                  <LayoutGrid className="h-5 w-5" aria-hidden />
                </AppLink>
              ) : (
                <ImsAppMark className="h-8 w-8" />
              )}
              <p className="text-base font-semibold text-foreground">{inFloorBeat ? t('Stock') : 'FloorBeat IMS'}</p>
              {factoryName && <p className="ml-auto min-w-0 truncate text-sm text-muted">{factoryName}</p>}
              {!inFloorBeat && <ImsSignOut className={factoryName ? '-mr-2' : '-mr-2 ml-auto'} />}
            </div>
          </header>

          <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">
            <ImsQueueBar />
            {children}
          </main>

          <nav aria-label={t('Main pages')} className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <ul className="mx-auto flex max-w-lg">
              {tabs.map(({ to, label, Icon }) => {
                const active = imsTabActive(to, pathname);
                return (
                  <li key={to} className="min-w-0 flex-1">
                    <AppLink
                      href={imsHref(base, to)}
                      aria-current={active ? 'page' : undefined}
                      className={cn('flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium', active ? 'text-primary' : 'text-muted')}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="max-w-full truncate px-1">{label}</span>
                    </AppLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </ImsLinksProvider>
    </ImsQueueProvider>
  );
}
