'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Boxes, LayoutDashboard } from 'lucide-react';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { NotificationsGate } from '@/components/alerts-app/notifications-gate';
import { SwBoot } from '@/components/alerts-app/sw-boot';
import { SignOutButton } from '@/components/auth/sidebar-user-footer';
import { DashboardAppMark } from '@/components/dashboard-app/app-mark';
import { AppLink } from '@/components/ui/app-link';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { alertsApi } from '@/lib/alerts-app/api';
import { ALERTS_QUERY_KEY } from '@/lib/alerts-app/model';
import { followAlerts, keepSubscriptionFresh, setBadge } from '@/lib/alerts-app/push-client';
import { api } from '@/lib/api';
import { APP_HOME, TILE_HREF, inboxHref, staffTileHref, type AppTile } from '@/lib/dashboard-app';
import { useLocale, useT } from '@/lib/i18n/context';
import { imsApi, retryImsCall } from '@/lib/ims/api';
import { loadQueue, NO_QUEUE, subscribeQueue } from '@/lib/ims/queue-store';
import { qtyText } from '@/lib/ims/stock-view';
import { useNavigate } from '@/lib/navigation-context';
import { cn, normalizeMachineStatus } from '@/lib/utils';

/** How often the tiles' figures are asked for again while the home screen is on screen. */
export const HOME_REFRESH_MS = 60_000;

/** The figures a tile shows, worked out from the answers (pure: dashboard-app-home.test.ts). */
export function runningLine(machines: Array<{ status: string }> | undefined): { running: number; total: number } | null {
  if (!machines) return null;
  return { running: machines.filter((m) => normalizeMachineStatus(m.status) === 'running').length, total: machines.length };
}

/** "1,240 m · 36 pcs": each unit's quantity in stock (units are never added together); null when nothing is counted. */
export function stockLine(byUnit: Array<{ unit: string; qty: number | null }> | undefined, locale: Parameters<typeof qtyText>[1]): string | null {
  const counted = (byUnit ?? []).filter((u) => u.qty !== null && u.qty > 0);
  return counted.length ? counted.map((u) => `${qtyText(u.qty, locale)} ${u.unit}`).join(' · ') : null;
}

const TILE_LOOK: Record<AppTile, { Icon: typeof BellRing; tint: string }> = {
  alerts: { Icon: BellRing, tint: 'bg-orange-50 text-orange-600' },
  dashboard: { Icon: LayoutDashboard, tint: 'bg-sky-50 text-sky-700' },
  stock: { Icon: Boxes, tint: 'bg-teal-50 text-teal-700' },
};

/**
 * The FloorBeat app's home screen (the owner, 2026-11-27: "when user open that app, i want to show three apps inside
 * it: alerts, dashboard, IMS", "like making ps5 homescreen having multiple apps", "same in pwa and desktop"): a big
 * tile for each of the person's apps, each saying something live (new alerts, machines running now, what is in stock),
 * the same on a phone and a computer. In the installed app it opens only once the phone rings (the alerts' own rule:
 * NotificationsGate installedOnly). A tapped notification that opened the app here still lands on its alert.
 */
export function AppHomeScreen({ factoryId, factoryName, logoSrc, tiles, staff = false }: {
  factoryId: string;
  factoryName: string;
  logoSrc: string | null;
  tiles: AppTile[];
  /**
   * Our staff, for the factory they picked (lib/dashboard-app.ts staffTileHref): the apps at the factory's long
   * addresses and the way back to the factories; no alerts of their own (no push, no unread count, no ringing gate).
   */
  staff?: boolean;
}) {
  const hasAlerts = tiles.includes('alerts') && !staff;
  const screen = <HomeTiles factoryId={factoryId} factoryName={factoryName} logoSrc={logoSrc} tiles={tiles} staff={staff} />;
  return hasAlerts ? <NotificationsGate installedOnly>{screen}</NotificationsGate> : screen;
}

function HomeTiles({ factoryId, factoryName, logoSrc, tiles, staff }: { factoryId: string; factoryName: string; logoSrc: string | null; tiles: AppTile[]; staff: boolean }) {
  const { t } = useT();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      {tiles.includes('alerts') && !staff && <AlertsWatch />}
      <header className="flex items-center gap-3">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" height={40} className="h-10 max-w-[8rem] object-contain" />
        ) : (
          <DashboardAppMark className="h-10 w-10" />
        )}
        <div className="min-w-0 flex-1">
          {staff ? (
            // our staff: back to the factories, to pick another
            <AppLink href={APP_HOME} className="text-xs font-medium uppercase tracking-wide text-primary hover:underline">‹ {t('All factories')}</AppLink>
          ) : (
            <p className="text-xs font-medium uppercase tracking-wide text-muted">FloorBeat</p>
          )}
          <h1 className="truncate text-xl font-semibold text-foreground">{factoryName}</h1>
        </div>
        <SignOutButton factoryId={factoryId} className="shrink-0 text-sm text-muted hover:text-foreground" />
      </header>

      <nav aria-label={t('Apps')} className={cn('mt-6 grid gap-4', tiles.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {tiles.map((tile) => (
          <Tile key={tile} tile={tile} factoryId={factoryId} href={staff ? staffTileHref(tile, factoryId) : TILE_HREF[tile]} staff={staff} />
        ))}
      </nav>

      <div className="mt-auto flex justify-center pt-10">
        <LanguageToggle />
      </div>
    </div>
  );
}

/** One app's tile: its icon, its name and its live line (none for our staff's alerts: they have no inbox of their own). */
function Tile({ tile, factoryId, href, staff }: { tile: AppTile; factoryId: string; href: string; staff: boolean }) {
  const { t } = useT();
  const { Icon, tint } = TILE_LOOK[tile];
  const name = tile === 'alerts' ? t('Alerts') : tile === 'dashboard' ? t('Dashboard') : t('Stock');
  return (
    <AppLink
      href={href}
      className="group flex min-h-32 items-center gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md active:scale-[0.99] md:min-h-56 md:flex-col md:items-start md:justify-between md:p-6"
    >
      <span className={cn('relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl md:h-20 md:w-20', tint)}>
        <Icon className="h-8 w-8 md:h-10 md:w-10" aria-hidden />
        {tile === 'alerts' && !staff && <UnreadDot />}
      </span>
      <span className="min-w-0 flex-1 md:flex-none">
        <span className="block text-xl font-semibold text-foreground md:text-2xl">{name}</span>
        <span className="mt-1 block min-h-5 text-sm text-muted">
          {tile === 'alerts' ? (staff ? null : <AlertsLine />) : tile === 'dashboard' ? <MachinesLine factoryId={factoryId} /> : <StockLine factoryId={factoryId} />}
        </span>
      </span>
    </AppLink>
  );
}

/** The person's alerts, shared with the inbox (the same query), kept fresh while the home screen shows. */
function useAlerts() {
  return useQuery({
    queryKey: ALERTS_QUERY_KEY,
    queryFn: ({ signal }) => alertsApi.alerts({ limit: 100 }, signal),
    refetchInterval: HOME_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

function UnreadDot() {
  const { t } = useT();
  const unread = useAlerts().data?.unread ?? 0;
  if (unread <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 min-w-6 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-semibold text-white ring-2 ring-white" aria-label={t('{count} unread', { count: unread })}>
      {unread}
    </span>
  );
}

function AlertsLine() {
  const { t, tn } = useT();
  const alerts = useAlerts();
  if (!alerts.data) return <Placeholder failed={alerts.isError} />;
  const unread = alerts.data.unread ?? 0;
  return <>{unread > 0 ? tn(unread, '{count} new alert', '{count} new alerts', { count: unread }) : t('No new alerts')}</>;
}

function MachinesLine({ factoryId }: { factoryId: string }) {
  const { t } = useT();
  const machines = useQuery({
    queryKey: ['app-home-machines', factoryId],
    // the last hour: each machine's state now (the window only bounds the figures, which this tile does not show)
    queryFn: ({ signal }) => {
      const to = new Date();
      return api.availability(factoryId, { from: new Date(to.getTime() - 3_600_000).toISOString(), to: to.toISOString() }, { signal });
    },
    refetchInterval: HOME_REFRESH_MS,
    retry: 1,
  });
  const line = runningLine(machines.data?.machines);
  if (!line) return <Placeholder failed={machines.isError} />;
  if (line.total === 0) return <>{t('No machines yet')}</>;
  return <>{t('{running} of {total} machines running', { running: line.running, total: line.total })}</>;
}

function StockLine({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const locale = useLocale();
  const stock = useQuery({
    queryKey: ['app-home-stock', factoryId],
    queryFn: ({ signal }) => imsApi.stock(factoryId, 'limit=1', null, signal),
    refetchInterval: HOME_REFRESH_MS,
    retry: retryImsCall,
  });
  // what waits on this phone to be sent (kept per factory: lib/ims/queue-store.ts)
  const queue = useSyncExternalStore(subscribeQueue, () => loadQueue(factoryId), () => NO_QUEUE);
  const waiting = queue.filter((q) => !q.rejected).length;
  if (!stock.data) return <Placeholder failed={stock.isError} />;
  const amount = stockLine(stock.data.totals.by_unit, locale);
  return (
    <>
      {amount ? t('In stock: {amount}', { amount }) : t('Nothing in stock yet.')}
      {waiting > 0 && <span className="block font-medium text-amber-700">{tn(waiting, '{count} waiting to send', '{count} waiting to send', { count: waiting })}</span>}
    </>
  );
}

/** A line's place while its figure is on its way (or could not be had: the tile still opens its app). */
function Placeholder({ failed }: { failed: boolean }) {
  if (failed) return null;
  return <span className="inline-block h-4 w-32 animate-pulse rounded bg-slate-100 align-middle" aria-hidden />;
}

/**
 * The alerts' side of the home screen: the service worker (it shows the pushes in the person's language), the phone's
 * push registration kept fresh, the unread count on the app's icon, and a tapped notification that opened the app here
 * taken on to its alert (/inbox/alerts/<id>). A push arriving refreshes the alerts tile.
 */
function AlertsWatch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const unread = useAlerts().data?.unread ?? 0;
  // Where this page is, in the alerts' own paths: none of them (not their inbox "/"), so a tap for any alert
  // page, the inbox too, moves on from the home screen.
  const here = useMemo(() => () => '/home', []);

  useEffect(() => followAlerts({
    refresh: () => { void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY }); },
    go: (url) => navigate(inboxHref(url)),
    here,
  }), [queryClient, navigate, here]);
  useEffect(() => { void keepSubscriptionFresh(); }, []);
  useEffect(() => { setBadge(unread); }, [unread]);
  return <SwBoot />;
}
