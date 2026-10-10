'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Factory, Menu, X } from 'lucide-react';

import { SidebarUserFooter } from '@/components/auth/sidebar-user-footer';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/lib/auth-context';
import { visibleInternalNav } from '@/lib/internal-nav';
import { cn } from '@/lib/utils';

function InternalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = visibleInternalNav(user);

  return (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Factory className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">ESP IoT</p>
            <p className="text-xs text-amber-300/90">Staff · Internal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map(({ href, label }) => {
            const active = pathname === href || (href !== '/internal' && pathname.startsWith(`${href}/`));
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {label}
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
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <InternalSidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-sidebar shadow-xl">
            <button type="button" className="absolute right-3 top-3 text-white" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <InternalSidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
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
