import { HydrationBoundary } from '@tanstack/react-query';

import { AlertDetail } from '@/components/alerts-app/alert-detail';
import { alertsAhead } from '@/lib/server/alerts-ahead';

export const dynamic = 'force-dynamic';

/** One alert (a tapped notification lands here): it comes with the page (lib/server/alerts-ahead.ts). */
export default async function AlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <HydrationBoundary state={await alertsAhead({ alertId: id, inbox: false })}>
      <AlertDetail id={id} />
    </HydrationBoundary>
  );
}
