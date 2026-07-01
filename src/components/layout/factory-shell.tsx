import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { SignOutButton } from '@/components/auth/sidebar-user-footer';
import { PageHeader } from '@/components/layout/app-shell';
import { FactoryNav, FactorySidebar } from '@/components/layout/factory-sidebar';
import { FactoryRefsProvider, type FactoryRefs } from '@/lib/factory-refs-context';
import { RefreshProvider } from '@/lib/refresh-context';
import type { Shift } from '@/lib/types';

/** Isolated shell for a single factory — no platform nav, no other factories. */
export function FactoryShell({
  factoryId,
  factoryName,
  location,
  shifts,
  tabs,
  description,
  refs,
  children,
}: {
  factoryId: string;
  factoryName: string;
  location?: string | null;
  shifts: Shift[];
  tabs: Array<{ slug: string; label: string; href: string }>;
  description?: string;
  refs: FactoryRefs;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-screen w-64 shrink-0 lg:block">
        <FactorySidebar
          factoryId={factoryId}
          factoryName={factoryName}
          location={location}
          shifts={shifts}
          tabs={tabs}
        />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b bg-white px-4 py-2.5 lg:hidden">
          <Link
            href="/overview"
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Platform
          </Link>
          <SignOutButton factoryId={factoryId} />
        </div>
        <PageHeader title={factoryName} description={description} />
        <FactoryNav tabs={tabs} />
        <div className="flex-1">
          <FactoryRefsProvider value={refs}>
            <RefreshProvider>{children}</RefreshProvider>
          </FactoryRefsProvider>
        </div>
      </main>
    </div>
  );
}
