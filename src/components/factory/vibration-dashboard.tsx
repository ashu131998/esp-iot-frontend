'use client';

import { SensorDashboard } from '@/components/factory/sensor-dashboard';

/** Vibration: RS485 vibration sensors (velocity per axis, ISO 10816 zones), per machine. */
export function VibrationDashboard({ factoryId }: { factoryId: string }) {
  return <SensorDashboard factoryId={factoryId} kind="vibration" />;
}
