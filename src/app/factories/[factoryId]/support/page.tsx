import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/app-shell';
import { SupportPage } from '@/components/support/support-page';
import { getT } from '@/lib/i18n/server';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function FactorySupportPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  const { t } = await getT();

  return (
    <NavDim>
      <PageHeader title={t('Support')} description={t('Tell us about a problem: we reply here and by email')} />
      <div className="p-4 sm:p-6 lg:p-8">
        {/* useSearchParams (a ticket opened from an email's link) */}
        <Suspense>
          <SupportPage factoryId={factoryId} />
        </Suspense>
      </div>
    </NavDim>
  );
}

export default factoryPage('support', FactorySupportPage);
