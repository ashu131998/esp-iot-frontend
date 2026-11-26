'use client';

import { Boxes, House, ScanLine } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { ImsAppMark } from '@/components/ims-app/app-mark';
import { ImsQueueBar } from '@/components/ims-app/queue-bar';
import { ImsQueueProvider } from '@/components/ims-app/queue-context';
import { ImsSignOut } from '@/components/ims-app/sign-out';
import { AppLink } from '@/components/ui/app-link';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/** The page a bottom-bar tab stands for (plain addresses: /, /stock…), served from /ims-app/… inside. */
export function imsTabActive(tab: '/' | '/scan' | '/stock', pathname: string): boolean {
  const path = pathname.replace(/^\/ims-app(?=\/|$)/, '') || '/';
  return tab === '/' ? path === '/' : path === tab || path.startsWith(`${tab}/`);
}

/**
 * The signed-in app's frame: a slim top bar (with Sign out), what waits on the phone to be sent (on every
 * tab: sending goes on whichever is open), and a bottom bar with big tabs. Count and the rest join the
 * bar as their screens are built.
 */
export function ImsAppShell({ factoryId, factoryName, children }: { factoryId: string; factoryName: string | null; children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const tabs = [
    { to: '/' as const, label: t('Home'), Icon: House },
    { to: '/scan' as const, label: t('Scan QR'), Icon: ScanLine },
    { to: '/stock' as const, label: t('Available stock'), Icon: Boxes },
  ];

  return (
    <ImsQueueProvider factoryId={factoryId}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
            <ImsAppMark className="h-8 w-8" />
            <p className="text-base font-semibold text-foreground">FloorBeat IMS</p>
            {factoryName && <p className="ml-auto min-w-0 truncate text-sm text-muted">{factoryName}</p>}
            <ImsSignOut className={factoryName ? '-mr-2' : '-mr-2 ml-auto'} />
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
                    href={to}
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
    </ImsQueueProvider>
  );
}
