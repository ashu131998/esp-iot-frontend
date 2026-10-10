import { PageHeader } from '@/components/layout/internal-shell';
import { UsersPanel } from '@/components/internal/users-panel';

export default function InternalUsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Factory accounts and staff (owner-only staff tab)" />
      <UsersPanel />
    </>
  );
}
