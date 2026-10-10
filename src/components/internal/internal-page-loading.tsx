import {
  PageContentSkeleton,
  PageHeaderSkeleton,
  StatCardSkeleton,
} from '@/components/ui/page-skeletons';

/** Route-level fallback for internal list/table pages (mirrors factory `team/loading.tsx`). */
export function InternalTablePageLoading({
  tableRows = 8,
  statCards = 0,
}: {
  tableRows?: number;
  statCards?: number;
}) {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContentSkeleton statCards={statCards} withChart={false} withTable tableRows={tableRows} />
    </>
  );
}

export function InternalFactoriesPageLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 lg:p-8 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
