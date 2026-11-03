'use client';

import { SensorDashboard } from '@/components/factory/sensor-dashboard';

/** Temperature: probes on the boards' T1 / T2 inputs and RS485 temperature transmitters, per machine. */
export function TemperatureDashboard({ factoryId }: { factoryId: string }) {
  return <SensorDashboard factoryId={factoryId} kind="temperature" />;
}
