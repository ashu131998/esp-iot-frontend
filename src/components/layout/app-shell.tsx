import { Skeleton } from '@/components/ui/skeleton';
import { PlatformPageSkeleton } from '@/components/ui/page-skeletons';
import { serverApi } from '@/lib/server-api';
import { PageContent, PageHeader } from './page-header';
import { Sidebar } from './sidebar';

export { PageContent, PageHeader };

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
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
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
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">{children}</main>
    </div>
  );
}

