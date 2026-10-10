import { PageContentSkeleton, PageHeaderSkeleton } from '@/components/ui/page-skeletons';

export default function InternalHealthLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContentSkeleton statCards={3} withTable={false} />
    </>
  );
}
