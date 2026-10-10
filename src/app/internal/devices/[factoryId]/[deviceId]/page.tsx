import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { DeviceDetailPanel } from '@/components/internal/device-detail-panel';
import { PageHeader } from '@/components/layout/page-header';

export default async function InternalDeviceDetailPage({
  params,
}: {
  params: Promise<{ factoryId: string; deviceId: string }>;
}) {
  const { factoryId, deviceId } = await params;
  const decodedFactory = decodeURIComponent(factoryId);
  const decodedDevice = decodeURIComponent(deviceId);

  return (
    <>
      <PageHeader
        title={decodedDevice}
        description={`${decodedFactory} · telemetry & raw readings`}
        actions={
          <Link href="/internal/nodes" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            All nodes
          </Link>
        }
      />
      <DeviceDetailPanel factoryId={decodedFactory} deviceId={decodedDevice} />
    </>
  );
}
