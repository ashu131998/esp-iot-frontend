import { redirect } from 'next/navigation';

/** The vibration page lives on Predictive maintenance now; old links land there. */
export default async function VibrationPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  redirect(`/factories/${factoryId}/maintenance?tab=vibration`);
}
