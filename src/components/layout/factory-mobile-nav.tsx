'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, MoreHorizontal, X } from 'lucide-react';

import { SignOutButton } from '@/components/auth/sidebar-user-footer';
import { BrandMark } from '@/components/layout/brand-mark';
import { FactoryPlatformBack } from '@/components/layout/factory-platform-back';
import { tabIcon } from '@/components/layout/factory-sidebar';
import { bottomBarTabs, shortLabel } from '@/lib/mobile-nav';
import { useNavigate } from '@/lib/navigation-context';
import { cn } from '@/lib/utils';
import type { Shift } from '@/lib/types';

type Tab = { slug: string; label: string; href: string };

/**
 * Phones (below lg), in place of the sidebar: a slim top bar, a bottom bar with the main
 * pages (lib/mobile-nav.ts) and a menu with every page, the shifts and sign-out.
 */
export function FactoryMobileNav({
  factoryId,
  factoryName,
  logoSrc,
  location,
  shifts,
  tabs,
}: {
  factoryId: string;
  factoryName: string;
  logoSrc?: string | null;
  location?: string | null;
  shifts: Shift[];
  tabs: Tab[];
}) {
  const pathname = usePathname();
  const navigate = useNavigate();
  // Both belong to the page they were set on, so arriving on another page clears them.
  const [pending, setPending] = useState<{ href: string; on: string } | null>(null);
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;
  const setMenuOpen = (open: boolean) => setMenuOpenOn(open ? pathname : null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenOn(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const current = pending?.on === pathname ? pending.href : pathname;
  const go = (href: string) => {
    setMenuOpen(false);
    if (pathname !== href) {
      setPending({ href, on: pathname });
      navigate(href);
    }
  };
  const bar = bottomBarTabs(tabs);
  const onBar = bar.some((t) => t.href === current);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur lg:hidden">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
        ) : (
          <BrandMark className="h-8 w-8" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{factoryName}</p>
          {location && <p className="truncate text-xs leading-tight text-muted">{location}</p>}
        </div>
        <button
          type="button"
          aria-label="Menu"
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
          className="-mr-2 rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <nav
        aria-label="Main pages"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {bar.map((tab) => {
            const Icon = tabIcon(tab.slug);
            const active = current === tab.href;
            return (
              <li key={tab.href} className="min-w-0 flex-1">
                <BarButton active={active} onClick={() => go(tab.href)} label={shortLabel(tab)}>
                  <Icon className="h-5 w-5" />
                </BarButton>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <BarButton active={!onBar} onClick={() => setMenuOpen(true)} label="More" popup>
              <MoreHorizontal className="h-5 w-5" />
            </BarButton>
          </li>
        </ul>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <p className="truncate text-sm font-semibold">{factoryName}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMenuOpen(false)}
                className="-mr-2 rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="grid grid-cols-3 gap-2 p-3">
              {tabs.map((tab) => {
                const Icon = tabIcon(tab.slug);
                const active = current === tab.href;
                return (
                  <li key={tab.href}>
                    <button
                      type="button"
                      onClick={() => go(tab.href)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-center text-xs font-medium',
                        active ? 'border-primary bg-blue-50 text-primary' : 'text-foreground active:bg-slate-50',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="leading-tight">{tab.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {shifts.length > 0 && (
              <div className="border-t px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Shifts</p>
                <ul className="space-y-1 text-sm">
                  {shifts.map((s) => (
                    <li key={s.shift_id} className="flex justify-between gap-2">
                      <span>{s.name}</span>
                      <span className="text-muted">{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between border-t px-4 py-4">
              <FactoryPlatformBack factoryId={factoryId} />
              <SignOutButton factoryId={factoryId} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BarButton({
  active,
  onClick,
  label,
  popup,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  popup?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active && !popup ? 'page' : undefined}
      aria-haspopup={popup ? 'dialog' : undefined}
      className={cn(
        'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
        active ? 'text-primary' : 'text-muted',
      )}
    >
      {children}
      <span className="max-w-full truncate px-1">{label}</span>
    </button>
  );
}
