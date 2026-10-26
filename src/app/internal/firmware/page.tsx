import { FirmwarePanel } from '@/components/internal/firmware-panel';
import { PageHeader } from '@/components/layout/page-header';

export default function InternalFirmwarePage() {
  return (
    <>
      <PageHeader
        title="Firmware"
        description="Signed releases for remote updates — offer one to a board from the Boards page (super admin only)"
      />
      <FirmwarePanel />
    </>
  );
}
