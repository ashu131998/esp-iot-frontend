import { AuditLogPanel } from '@/components/internal/audit-log-panel';
import { PageHeader } from '@/components/layout/page-header';

export default function InternalAuditPage() {
  return (
    <>
      <PageHeader title="Audit log" description="Owner-only trail of admin mutations" />
      <AuditLogPanel />
    </>
  );
}
