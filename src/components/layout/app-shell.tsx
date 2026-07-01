import { Skeleton } from '@/components/ui/skeleton';
import { PlatformPageSkeleton } from '@/components/ui/page-skeletons';
import { serverApi } from '@/lib/server-api';
import { cn } from '@/lib/utils';

import { Sidebar } from './sidebar';

export function AppShellFallback() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-screen w-64 shrink-0 bg-sidebar lg:block">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg bg-white/10" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-16 bg-white/10" />
              <Skeleton className="h-3 w-24 bg-white/10" />
            </div>
          </div>
        </div>
        <div className="space-y-2 px-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg bg-white/10" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <PlatformPageSkeleton />
      </main>
    </div>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  let factories: Array<{ factory_id: string; name: string }> = [];
  try {
    const data = await serverApi.factories();
    factories = data.factories.map((f) => ({ factory_id: f.factory_id, name: f.name }));
  } catch {
    factories = [];
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar factories={factories} />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-white px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard responsive page padding — use instead of raw p-8. */
export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('p-4 sm:p-6 lg:p-8', className)}>{children}</div>;
}
