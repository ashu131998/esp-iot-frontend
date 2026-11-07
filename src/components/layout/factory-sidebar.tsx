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
import { SIDEBAR_CARD, SIDEBAR_HEADING, SIDEBAR_PANEL, sidebarIconClass, sidebarItemClass } from '@/components/layout/sidebar-styles';
import { useAuth } from '@/lib/auth-context';
import { sidebarGroups, tabsFor } from '@/lib/display';
import { currentShiftWindow } from '@/lib/shifts';
import { useT } from '@/lib/i18n/context';
import { PlantSwitcher } from '@/components/layout/plant-switcher';
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
  const groups = sidebarGroups(visible).map((g) => ({ ...g, title: g.key === 'monitor' ? t('Monitor') : t('Manage') }));

  return (
    <aside className={cn('sticky top-0 flex h-screen w-64 shrink-0 flex-col', SIDEBAR_PANEL)}>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-white/10" />
        ) : (
          <BrandMark className="h-10 w-10" />
        )}
        <PlantSwitcher factoryId={factoryId} factoryName={factoryName} subtitle={location ?? factoryId} tone="dark" />
      </div>

      {shifts.length > 0 && (
        <div className={cn('mx-3 px-3 py-2.5', SIDEBAR_CARD)}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{t('Shifts')}</p>
          <ul className="space-y-1 text-xs">
            {shifts.map((s) => {
              const now = currentShiftId === s.shift_id;
              return (
                <li key={s.shift_id} className="flex items-center justify-between gap-2">
                  <span className={cn('flex min-w-0 items-center gap-1.5', now ? 'font-medium text-slate-100' : 'text-slate-400')}>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        now ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]' : 'bg-slate-600',
                      )}
                    />
                    <span className="truncate">{t(s.name)}</span>
                    {now && (
                      <span className="rounded-full bg-emerald-400/10 px-1.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                        {t('Now')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">{s.label}</span>
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
        {isInternalStaff && <FactoryPlatformBack factoryId={factoryId} className="px-1 text-slate-400 hover:text-white" />}
      </SidebarUserFooter>
    </aside>
  );
}
