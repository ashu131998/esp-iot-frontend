'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { CalibrationWizard } from '@/components/factory/calibration-wizard';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/context';

/** Opens the calibration wizard for one machine; only people who can change the factory see it. */
export function CalibrateButton({ factoryId, machineId }: { factoryId: string; machineId: string }) {
  const { canWriteFactory } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!canWriteFactory) return null;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="mr-1.5 h-4 w-4" />
        {t('Calibrate')}
      </Button>
      {open && (
        <Sheet title={t('Calibrate')} onClose={() => setOpen(false)} size="lg">
          <CalibrationWizard factoryId={factoryId} machineId={machineId} onClose={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}
