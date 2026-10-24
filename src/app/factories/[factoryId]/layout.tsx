import { FactoryShellLoader } from '@/components/layout/factory-shell-loader';

export default async function FactoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return <FactoryShellLoader factoryId={factoryId}>{children}</FactoryShellLoader>;
}
