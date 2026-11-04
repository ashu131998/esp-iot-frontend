import { redirect } from 'next/navigation';

import { factoryLinks } from '@/lib/server/factory-links';

/** The vibration page lives on Predictive maintenance now; old links land there. */
export default async function VibrationPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  const link = await factoryLinks(factoryId);
  redirect(link(`/factories/${factoryId}/maintenance?tab=vibration`));
}
