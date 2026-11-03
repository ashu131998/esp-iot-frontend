'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Cable,
  CalendarClock,
  ClipboardCheck,
  Cog,
  Factory,
  FileText,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Thermometer,
  Wrench,
  Timer,
  TrendingUp,
  Users,
  Waves,
  Wifi,
  Workflow,
  Zap,
} from 'lucide-react';

import { SidebarUserFooter } from '@/components/auth/sidebar-user-footer';
import { BrandMark } from '@/components/layout/brand-mark';
import { FactoryPlatformBack } from '@/components/layout/factory-platform-back';
import { SIDEBAR_HEADING, SIDEBAR_PANEL, sidebarIconClass, sidebarItemClass } from '@/components/layout/sidebar-styles';
import { useAuth } from '@/lib/auth-context';
import { tabsFor } from '@/lib/display';
import { currentShiftWindow } from '@/lib/shifts';
import { useT } from '@/lib/i18n/context';
import { useNavigate } from '@/lib/navigation-context';
import { cn } from '@/lib/utils';
import type { Shift } from '@/lib/types';

const tabIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  results: TrendingUp,
  availability: Activity,
  'status-timeline': Timer,
  alerts: AlertTriangle,
  energy: Zap,
  maintenance: Wrench,
  vibration: Waves,
  temperature: Thermometer,
  performance: Gauge,
  production: Factory,
  quality: ClipboardCheck,
  lines: Workflow,
  configuration: Cog,
  scheduling: CalendarClock,
  'shift-reports': FileText,
  'sensor-mapping': Cable,
  wifi: Wifi,
  compliance: ShieldCheck,
  team: Users,
};

/** Pages for running the factory rather than watching it: the sidebar's second group. */
const MANAGE_PAGES = new Set(['lines', 'configuration', 'scheduling', 'shift-reports', 'sensor-mapping', 'wifi', 'team', 'compliance']);

export function tabIcon(slug: string): React.ComponentType<{ className?: string }> {
  return tabIcons[slug] ?? Activity;
}

export function FactorySidebar({
  factoryId,
  factoryName,
  logoSrc,
  location,
  shifts,
  tabs,
}: {
  factoryId: string;
  factoryName: string;
  /** The factory's own logo (branding); our mark when it has none. */
  logoSrc?: string | null;
  location?: string | null;
  shifts: Shift[];
  tabs: Array<{ slug: string; label: string; href: string }>;
}) {
  const pathname = usePathname();
  const navigate = useNavigate();
  const { canWriteFactory, isInternalStaff } = useAuth();
  const { t } = useT();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Which shift is on now: worked out after the page is up (the server's clock may sit on the other side of a change).
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setCurrentShiftId(shifts.length ? currentShiftWindow(shifts).shift.shift_id : null);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [shifts]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const visible = tabsFor(tabs, canWriteFactory);
  const groups = [
    { key: 'monitor', title: t('Monitor'), tabs: visible.filter((tab) => !MANAGE_PAGES.has(tab.slug)) },
    { key: 'manage', title: t('Manage'), tabs: visible.filter((tab) => MANAGE_PAGES.has(tab.slug)) },
  ].filter((g) => g.tabs.length > 0);

  return (
    <aside className={cn('sticky top-0 flex h-screen w-64 shrink-0 flex-col', SIDEBAR_PANEL)}>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-gray-100" />
        ) : (
          <BrandMark className="h-10 w-10" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{factoryName}</p>
          <p className="truncate text-xs text-muted">{location ?? factoryId}</p>
        </div>
      </div>

      {shifts.length > 0 && (
        <div className="mx-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t('Shifts')}</p>
          <ul className="space-y-1 text-xs">
            {shifts.map((s) => {
              const now = currentShiftId === s.shift_id;
              return (
                <li key={s.shift_id} className="flex items-center justify-between gap-2">
                  <span className={cn('flex min-w-0 items-center gap-1.5', now ? 'font-medium text-foreground' : 'text-slate-500')}>
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', now ? 'bg-emerald-500' : 'bg-gray-300')} />
                    <span className="truncate">{t(s.name)}</span>
                    {now && <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">{t('Now')}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-400">{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.key}>
            <p className={SIDEBAR_HEADING}>{group.title}</p>
            <ul className="space-y-0.5">
              {group.tabs.map((tab) => {
                const Icon = tabIcon(tab.slug);
                const active = pendingHref ? pendingHref === tab.href : pathname === tab.href;
                return (
                  <li key={tab.href}>
                    <button
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        if (pathname !== tab.href) {
                          setPendingHref(tab.href);
                          navigate(tab.href);
                        }
                      }}
                      className={sidebarItemClass(active)}
                    >
                      <Icon className={sidebarIconClass(active)} />
                      {t(tab.label)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <SidebarUserFooter factoryId={factoryId}>
        {isInternalStaff && <FactoryPlatformBack factoryId={factoryId} />}
      </SidebarUserFooter>
    </aside>
  );
}
