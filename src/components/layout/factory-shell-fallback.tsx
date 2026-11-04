import { PageHeader } from '@/components/layout/app-shell';
import { SIDEBAR_CARD, SIDEBAR_PANEL } from '@/components/layout/sidebar-styles';
import { FactoryPageSkeleton } from '@/components/ui/page-skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { getFactoryConfig } from '@/lib/factory-config';
import { DEFAULT_SHIFTS } from '@/lib/shifts';
import { cn } from '@/lib/utils';

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
      <aside className={cn('hidden h-screen w-64 shrink-0 lg:block', SIDEBAR_PANEL)}>
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <Skeleton className="h-10 w-10 rounded-xl bg-white/[0.08]" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-32 bg-white/[0.08]" />
            <Skeleton className="h-3 w-20 bg-white/[0.06]" />
          </div>
        </div>
        <div className={cn('mx-3 space-y-1.5 px-3 py-2.5', SIDEBAR_CARD)}>
          <Skeleton className="h-3 w-12 bg-white/[0.06]" />
          {DEFAULT_SHIFTS.map((s) => (
            <Skeleton key={s.shift_id} className="h-3 w-full bg-white/[0.06]" />
          ))}
        </div>
        <div className="space-y-1 px-3 py-4">
          {tabs.map((tab) => (
            <Skeleton key={tab.href} className="h-9 w-full rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
        {/* Phones: the top bar as FactoryMobileNav draws it; the bottom bar comes with the page. */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{config.name}</p>
        </div>
        <div className="hidden lg:block">
          <PageHeader title={config.name} description="Loading factory data…" />
        </div>
        <div className="flex-1">
          <FactoryPageSkeleton />
        </div>
      </main>
    </div>
  );
}
