import { Suspense } from 'react';

import { SupportQueue } from '@/components/internal/support-queue';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';

export default function InternalSupportPage() {
  return (
    <>
      <PageHeader
        title="Support"
        description="Tickets factories raised on their Support page: waiting on us first · refreshes every 30 s"
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* useSearchParams (a ticket opened from the email's link) */}
        <Suspense>
          <SupportQueue />
        </Suspense>
      </div>
    </>
  );
}
