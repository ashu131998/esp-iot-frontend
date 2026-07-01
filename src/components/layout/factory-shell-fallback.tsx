import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { FactoryNav } from '@/components/layout/factory-sidebar';
import { FactoryPageSkeleton } from '@/components/ui/page-skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { getFactoryConfig } from '@/lib/factory-config';
import { DEFAULT_SHIFTS } from '@/lib/shifts';

export function FactoryShellFallback({
  factoryId,
  tabs,
}: {
  factoryId: string;
  tabs: Array<{ slug: string; label: string; href: string }>;
}) {
  const config = getFactoryConfig(factoryId);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-screen w-64 shrink-0 bg-sidebar lg:block">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg bg-white/10" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-32 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
            </div>
          </div>
        </div>
        <div className="border-b border-white/10 px-5 py-3">
          <Skeleton className="mb-2 h-3 w-12 bg-white/10" />
          {DEFAULT_SHIFTS.map((s) => (
            <Skeleton key={s.shift_id} className="mb-1.5 h-3 w-full bg-white/10" />
          ))}
        </div>
        <div className="space-y-1 px-3 py-4">
          {tabs.map((tab) => (
            <Skeleton key={tab.href} className="h-9 w-full rounded-lg bg-white/10" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
        <div className="flex items-center justify-between border-b bg-white px-4 py-2.5 lg:hidden">
          <Link
            href="/overview"
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Platform
          </Link>
        </div>
        <PageHeader title={config.name} description="Loading factory data…" />
        <FactoryNav tabs={tabs} />
        <div className="flex-1">
          <FactoryPageSkeleton />
        </div>
      </main>
    </div>
  );
}
