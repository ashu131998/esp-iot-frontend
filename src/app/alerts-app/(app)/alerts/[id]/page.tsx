import { AlertDetail } from '@/components/alerts-app/alert-detail';

export const dynamic = 'force-dynamic';

export default async function AlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlertDetail id={id} />;
}
