'use client';

import { Boxes, House, ScanLine } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { ImsLinksProvider } from '@/components/ims-app/ims-links';
import { AppLink } from '@/components/ui/app-link';
import { useFactoryHref } from '@/lib/factory-links-context';
import { useT } from '@/lib/i18n/context';
import { imsHref, imsScreenOf } from '@/lib/ims/tab';
import { cn } from '@/lib/utils';

/**
 * FloorBeat IMS as the dashboard's Stock tab (one app: Ashutosh 2026-11-27): the IMS screens inside the
 * factory's own frame (its sidebar, its phone bottom bar), with the IMS's three screens as a row of tabs on
 * top. What waits on the phone to be sent is the factory frame's (factory-queue.tsx): the same scans and
 * photos as on ims.floorbeat.in, kept per factory on the phone, sent from whichever page is open.
 */
export function ImsDashboardFrame({ factoryId, children }: { factoryId: string; children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const base = useFactoryHref()(`/factories/${factoryId}/ims`);
  const active = imsScreenOf(pathname, base);
  const tabs = [
    { to: '/' as const, label: t('Home'), Icon: House },
    { to: '/scan' as const, label: t('Scan QR'), Icon: ScanLine },
    { to: '/stock' as const, label: t('Available stock'), Icon: Boxes },
  ];

  return (
    <ImsLinksProvider base={base}>
      {/* the waiting scans and photos: the factory frame's (factory-queue.tsx), on every page */}
      <div className="mx-auto w-full max-w-lg px-4 pb-6 pt-4">
        <nav aria-label={t('Stock')} className="mb-3 flex gap-1 rounded-2xl bg-slate-100 p-1">
          {tabs.map(({ to, label, Icon }) => (
            <AppLink
              key={to}
              href={imsHref(base, to)}
              aria-current={active === to ? 'page' : undefined}
              className={cn(
                'flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium',
                active === to ? 'bg-white text-primary shadow-sm' : 'text-muted',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </AppLink>
          ))}
        </nav>
        {children}
      </div>
    </ImsLinksProvider>
  );
}
