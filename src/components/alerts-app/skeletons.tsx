import { Skeleton } from '@/components/ui/skeleton';

/**
 * The alerts app's pages while they load, in the shape of what follows. The same ones show the moment
 * a tap opens a page (each page's loading.tsx, which the app fetches ahead with its links) and while
 * the page's own data is on its way, so the skeleton stays put and fills in.
 */
export function InboxSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function AlertSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}
