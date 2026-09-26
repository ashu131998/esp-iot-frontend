import type { LucideIcon } from 'lucide-react';
import { Radio } from 'lucide-react';

import { Card } from '@/components/ui/card';

export interface PlannedMetric {
  label: string;
  unit: string;
  hint?: string;
}

export type SensorAccent = 'violet' | 'amber';

// Full, static class strings per accent — Tailwind's JIT can't see interpolated
// names like `bg-${accent}-50`, so those would be purged. Keep these literal.
const ACCENTS: Record<
  SensorAccent,
  { banner: string; iconWrap: string; chip: string }
> = {
  violet: {
    banner: 'border-violet-200 bg-violet-50/50',
    iconWrap: 'bg-violet-100 text-violet-600',
    chip: 'bg-violet-100 text-violet-700',
  },
  amber: {
    banner: 'border-amber-200 bg-amber-50/50',
    iconWrap: 'bg-amber-100 text-amber-600',
    chip: 'bg-amber-100 text-amber-700',
  },
};

/**
 * Forward-looking empty state for sensor pages whose data pipeline is not live
 * yet (REV B hardware — vibration & temperature). Shows what the page will
 * display once devices start reporting, plus the hardware wiring for context.
 */
export function SensorComingSoon({
  icon: Icon,
  title,
  tagline,
  description,
  plannedMetrics,
  hardware,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  plannedMetrics: PlannedMetric[];
  hardware: { part: string; connection: string; note?: string };
  accent: SensorAccent;
}) {
  const a = ACCENTS[accent];

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <Card className={a.banner}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${a.chip}`}
              >
                <Radio className="h-3 w-3" />
                Awaiting sensors
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted">{tagline}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          </div>
        </div>
      </Card>

      {/* Planned metrics preview */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">What this page will show</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {plannedMetrics.map((m) => (
            <Card key={m.label} className="flex h-full flex-col gap-2 opacity-70">
              <span className="text-sm font-medium text-muted">{m.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-slate-300">—</span>
                <span className="text-xs font-medium text-slate-400">{m.unit}</span>
              </div>
              {m.hint && <p className="text-xs text-muted">{m.hint}</p>}
            </Card>
          ))}
        </div>
      </div>

      {/* Hardware context */}
      <Card>
        <h3 className="text-sm font-semibold text-foreground">Hardware</h3>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Sensor</dt>
            <dd className="mt-0.5 font-medium text-foreground">{hardware.part}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Connection</dt>
            <dd className="mt-0.5 font-medium text-foreground">{hardware.connection}</dd>
          </div>
          {hardware.note && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted">Note</dt>
              <dd className="mt-0.5 text-muted">{hardware.note}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
