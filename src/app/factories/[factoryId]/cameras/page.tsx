import { CamerasDashboard } from '@/components/factory/cameras-dashboard';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/**
 * Cameras: the factory's cameras — each one's last picture and live view, and what it saw (something in front of it)
 * with the pictures. Admins ask for a picture and set each camera up here. No dates: it is about now.
 */
async function CamerasPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  return (
    <NavDim className="space-y-6 p-4 sm:p-6 lg:p-8">
      <CamerasDashboard factoryId={factoryId} />
    </NavDim>
  );
}

export default factoryPage('cameras', CamerasPage);
