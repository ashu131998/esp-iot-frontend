import { FactorySetupPanel } from '@/components/internal/factory-setup-panel';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function InternalFactorySetupPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return (
    <>
      <PageHeader
        title="Factory setup"
        description="Lines, machines, and node registration for this site"
      />
      <FactorySetupPanel factoryId={factoryId} />
    </>
  );
}
