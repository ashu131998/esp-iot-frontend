import { redirect } from 'next/navigation';

/** The temperature page lives on Predictive maintenance now; old links land there. */
export default async function TemperaturePage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  redirect(`/factories/${factoryId}/maintenance?tab=temperature`);
}
