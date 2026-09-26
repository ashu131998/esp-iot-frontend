import { Waves } from 'lucide-react';

import { SensorComingSoon } from '@/components/factory/sensor-coming-soon';

export function VibrationDashboard() {
  return (
    <SensorComingSoon
      icon={Waves}
      accent="violet"
      title="Vibration Monitoring"
      tagline="Predictive maintenance from motor vibration — REV B hardware"
      description="Each REV B node reads a 3-axis accelerometer mounted on the machine motor. Once
        firmware ships the vibration channel, this page will trend RMS velocity and peak acceleration
        per machine, flag bearing wear and imbalance early, and raise alerts when levels cross ISO
        10816 severity zones. No node is reporting vibration yet."
      plannedMetrics={[
        { label: 'RMS Velocity', unit: 'mm/s', hint: 'ISO 10816 severity' },
        { label: 'Peak Acceleration', unit: 'g' },
        { label: 'Dominant Frequency', unit: 'Hz', hint: 'FFT fundamental' },
        { label: 'Per-axis (X / Y / Z)', unit: 'g' },
      ]}
      hardware={{
        part: 'LIS3DH 3-axis MEMS accelerometer (I²C 0x18)',
        connection: 'External module on the motor, wired to header J2 (shares the I²C bus — no new GPIO)',
        note: 'The accelerometer is not on the node PCB; it mounts on the machine and connects via J2. Firmware driver (SR-4) is pending.',
      }}
    />
  );
}
