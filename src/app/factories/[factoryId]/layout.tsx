import { FactoryShellLoader } from '@/components/layout/factory-shell-loader';
import { factoryTabs } from '@/lib/factory-config';

export default async function FactoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  const tabs = factoryTabs(factoryId);

  return (
    <FactoryShellLoader factoryId={factoryId} tabs={tabs}>
      {children}
    </FactoryShellLoader>
  );
}
