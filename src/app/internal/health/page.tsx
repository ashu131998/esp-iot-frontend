import { SystemHealthPanel } from '@/components/internal/system-health-panel';
import { PageHeader } from '@/components/layout/page-header';

export default function InternalHealthPage() {
  return (
    <>
      <PageHeader title="System health" description="Query API, fleet summary, and aggregator heartbeat" />
      <SystemHealthPanel />
    </>
  );
}
