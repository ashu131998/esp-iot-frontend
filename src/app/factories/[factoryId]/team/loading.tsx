import { PageContentSkeleton, PageHeaderSkeleton } from '@/components/ui/page-skeletons';

export default function TeamLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContentSkeleton statCards={0} tableRows={4} />
    </>
  );
}
