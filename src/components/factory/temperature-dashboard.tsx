'use client';

import { Thermometer } from 'lucide-react';

import { SensorComingSoon } from '@/components/factory/sensor-coming-soon';
import { useT } from '@/lib/i18n/context';

export function TemperatureDashboard() {
  const { t } = useT();
  return (
    <SensorComingSoon
      icon={Thermometer}
      accent="amber"
      title={t('Temperature Monitoring')}
      tagline={t('Motor & ambient temperature trends — REV B hardware')}
      description={t('REV B nodes support a OneWire digital temperature probe on terminal block TB10. Once firmware ships the temperature channel, this page will trend current, min, max and average temperature per machine over the selected window, and raise alerts when a machine runs hot. No node is reporting temperature yet.')}
      plannedMetrics={[
        { label: t('Current Temp'), unit: '°C' },
        { label: t('Average'), unit: '°C', hint: t('over window') },
        { label: t('Peak'), unit: '°C', hint: t('max in window') },
        { label: t('Over-threshold'), unit: t('events') },
      ]}
      hardware={{
        part: t('OneWire digital temperature sensor (DS18B20-class)'),
        connection: t('Terminal block TB10 — TEMP DQ (data) + TEMP 3V3 (power)'),
        note: t('Hardware channel is present on the REV B board; the firmware OneWire read path is pending.'),
      }}
    />
  );
}
