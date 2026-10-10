import { PageContentSkeleton, PageHeaderSkeleton } from '@/components/ui/page-skeletons';

export default function InternalAlertsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContentSkeleton statCards={3} withChart={false} withTable tableRows={4} />
    </>
  );
}
