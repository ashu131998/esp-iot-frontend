import { BottlesDashboard } from '@/components/factory/bottles-dashboard';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/**
 * Bottles: the dye bottles a camera watches at a machine — each one's level now, the camera's last
 * picture with the boxes drawn on it, and the changes (low, missing, refilled) with the pictures the
 * camera took. Admins draw the boxes and name the colours here. No dates: it is about now.
 */
async function BottlesPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  return (
    <NavDim className="space-y-6 p-4 sm:p-6 lg:p-8">
      <BottlesDashboard factoryId={factoryId} />
    </NavDim>
  );
}

export default factoryPage('bottles', BottlesPage);
