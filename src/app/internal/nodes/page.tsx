import { NodesFleetPanel } from '@/components/internal/nodes-fleet-panel';
import { PageHeader } from '@/components/layout/page-header';

export default function InternalNodesPage() {
  return (
    <>
      <PageHeader
        title="Nodes"
        description="All ESP32 nodes — filter by factory, line, or machine linkage"
      />
      <NodesFleetPanel />
    </>
  );
}
