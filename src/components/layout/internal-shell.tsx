'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  CircuitBoard,
  HeartPulse,
  House,
  Mail,
  Menu,
  Package,
  Palette,
  Radio,
  Rocket,
  ScrollText,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { SidebarUserFooter } from '@/components/auth/sidebar-user-footer';
import { BrandMark } from '@/components/layout/brand-mark';
import { PageHeader } from '@/components/layout/page-header';
import { SIDEBAR_PANEL, sidebarIconClass, sidebarItemClass } from '@/components/layout/sidebar-styles';
import { useAuth } from '@/lib/auth-context';
import { visibleInternalNav } from '@/lib/internal-nav';
import { cn } from '@/lib/utils';

const NAV_ICONS: Record<string, LucideIcon> = {
  '/internal': House,
  '/internal/factories': Building2,
  '/internal/alerts': Bell,
  '/internal/shift-reports': Mail,
  '/internal/nodes': Radio,
  '/internal/boards': CircuitBoard,
  '/internal/firmware': Package,
  '/internal/health': HeartPulse,
  '/internal/onboard': Rocket,
  '/internal/features': Palette,
  '/internal/users': Users,
  '/internal/audit': ScrollText,
};

function InternalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = visibleInternalNav(user);

  return (
    <>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <BrandMark className="h-10 w-10" />
        <div>
          <p className="text-sm font-semibold text-foreground">FloorBeat</p>
          <p className="text-xs font-medium text-amber-600">Staff · Internal</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5 pt-2">
          {items.map(({ href, label }) => {
            const active = pathname === href || (href !== '/internal' && pathname.startsWith(`${href}/`));
            const Icon = NAV_ICONS[href];
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={sidebarItemClass(active)}
                >
                  {Icon && <Icon className={sidebarIconClass(active)} />}
                  <span className="truncate">{label}</span>
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

export function InternalShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={cn('hidden h-screen w-64 shrink-0 flex-col lg:flex', SIDEBAR_PANEL)}>
        <InternalSidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className={cn('relative flex h-full w-64 flex-col shadow-xl', SIDEBAR_PANEL)}>
            <button type="button" aria-label="Close menu" className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-gray-50 hover:text-foreground" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <InternalSidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-none [scrollbar-gutter:stable]">
        <div className="flex items-center gap-2 border-b bg-white px-4 py-2.5 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1 hover:bg-slate-100">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">Internal ops</span>
        </div>
        {children}
      </main>
    </div>
  );
}

export { PageHeader };
