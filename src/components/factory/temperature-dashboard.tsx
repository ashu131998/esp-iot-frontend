import { Thermometer } from 'lucide-react';

import { SensorComingSoon } from '@/components/factory/sensor-coming-soon';

export function TemperatureDashboard() {
  return (
    <SensorComingSoon
      icon={Thermometer}
      accent="amber"
      title="Temperature Monitoring"
      tagline="Motor & ambient temperature trends — REV B hardware"
      description="REV B nodes support a OneWire digital temperature probe on terminal block TB10. Once
        firmware ships the temperature channel, this page will trend current, min, max and average
        temperature per machine over the selected window, and raise alerts when a machine runs hot.
        No node is reporting temperature yet."
      plannedMetrics={[
        { label: 'Current Temp', unit: '°C' },
        { label: 'Average', unit: '°C', hint: 'over window' },
        { label: 'Peak', unit: '°C', hint: 'max in window' },
        { label: 'Over-threshold', unit: 'events' },
      ]}
      hardware={{
        part: 'OneWire digital temperature sensor (DS18B20-class)',
        connection: 'Terminal block TB10 — TEMP DQ (data) + TEMP 3V3 (power)',
        note: 'Hardware channel is present on the REV B board; the firmware OneWire read path is pending.',
      }}
    />
  );
}
