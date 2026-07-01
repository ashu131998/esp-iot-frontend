'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Cog,
  Factory,
  Gauge,
  LayoutDashboard,
  Settings,
  Timer,
  Workflow,
  Zap,
} from 'lucide-react';

import { SidebarUserFooter } from '@/components/auth/sidebar-user-footer';
import { useNavigate } from '@/lib/navigation-context';
import { cn } from '@/lib/utils';
import type { Shift } from '@/lib/types';

const tabIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  availability: Activity,
  'status-timeline': Timer,
  alerts: AlertTriangle,
  energy: Zap,
  performance: Gauge,
  production: Factory,
  quality: AlertTriangle,
  lines: Workflow,
  configuration: Cog,
  scheduling: CalendarClock,
  compliance: Settings,
  team: Settings,
};

export function FactorySidebar({
  factoryId,
  factoryName,
  location,
  shifts,
  tabs,
}: {
  factoryId: string;
  factoryName: string;
  location?: string | null;
  shifts: Shift[];
  tabs: Array<{ slug: string; label: string; href: string }>;
}) {
  const pathname = usePathname();
  const navigate = useNavigate();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Factory className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{factoryName}</p>
            <p className="truncate text-xs text-slate-400">{location ?? factoryId}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Shifts</p>
        <ul className="space-y-1.5 text-xs text-slate-300">
          {shifts.map((s) => (
            <li key={s.shift_id} className="flex justify-between gap-2">
              <span>{s.name}</span>
              <span className="text-slate-500">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tabIcons[tab.slug] ?? Activity;
            const active = pendingHref ? pendingHref === tab.href : pathname === tab.href;
            return (
              <li key={tab.href}>
                <button
                  onClick={() => {
                    if (pathname !== tab.href) {
                      setPendingHref(tab.href);
                      navigate(tab.href);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <SidebarUserFooter factoryId={factoryId} />
    </aside>
  );
}

export function FactoryNav({ tabs }: { tabs: Array<{ slug: string; label: string; href: string }> }) {
  const pathname = usePathname();
  const navigate = useNavigate();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <div className="border-b bg-white lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.slug] ?? Activity;
          const active = pendingHref ? pendingHref === tab.href : pathname === tab.href;
          return (
            <button
              key={tab.href}
              onClick={() => {
                if (pathname !== tab.href) {
                  setPendingHref(tab.href);
                  navigate(tab.href);
                }
              }}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:border-slate-200 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
