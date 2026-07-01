'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Cog,
  Factory,
  Gauge,
  LayoutDashboard,
  Menu,
  Settings,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

import { SidebarUserFooter } from '@/components/auth/sidebar-user-footer';
import { cn } from '@/lib/utils';

const platformNav = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/factories', label: 'Factories', icon: Building2 },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function SidebarContent({
  factories,
  pathname,
  onNavigate,
}: {
  factories: Array<{ factory_id: string; name: string }>;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Factory className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">ESP IoT</p>
            <p className="text-xs text-slate-400">Operations Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Platform
        </p>
        <ul className="space-y-1">
          {platformNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Factories
        </p>
        <ul className="space-y-1">
          {factories.map((f) => {
            const href = `/factories/${f.factory_id}`;
            const active = pathname.startsWith(href);
            return (
              <li key={f.factory_id}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Gauge className="h-4 w-4" />
                  <span className="truncate">{f.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <SidebarUserFooter />
    </>
  );
}

export function Sidebar({ factories }: { factories: Array<{ factory_id: string; name: string }> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Factory className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm font-semibold">ESP IoT</p>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              factories={factories}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent factories={factories} pathname={pathname} />
      </aside>
    </>
  );
}

/** Horizontal tab nav for factory pages on mobile (legacy export kept for compatibility). */
export function FactoryNav({
  factoryId: _factoryId,
  tabs,
}: {
  factoryId: string;
  tabs: Array<{ slug: string; label: string; href: string }>;
}) {
  const pathname = usePathname();

  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    overview: LayoutDashboard,
    availability: Activity,
    energy: Zap,
    performance: Gauge,
    production: Factory,
    quality: AlertTriangle,
    lines: Workflow,
    configuration: Cog,
    compliance: Settings,
  };

  return (
    <div className="border-b bg-white">
      <div className="flex gap-1 overflow-x-auto px-1">
        {tabs.map((tab) => {
          const Icon = icons[tab.slug] ?? Activity;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:border-slate-200 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
