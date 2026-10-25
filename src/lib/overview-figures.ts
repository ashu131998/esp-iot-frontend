import type { AvailabilityMachine, EnergyMachine, PerformanceMachine, ProductionMachine } from '@/lib/types';
import { averageKnown, knownNumber, sharedUnitLabel, sumUnits } from '@/lib/utils';

/**
 * What a machine made, or null when that is unknown: no production sensor, or no
 * count received in the period. Shown as "—", never as 0.
 */
export function unitsMade(prod: Pick<ProductionMachine, 'units_produced' | 'status'> | undefined): number | null {
  return prod?.status === 'computed' ? prod.units_produced : null;
}

/**
 * The overview's figures for the machines in scope, each by the rule of its own
 * page, so the overview never disagrees with them:
 * - running time: the Availability page's average (machines with no data left out, not counted as 0 %)
 * - made: the counts that arrived; null when none did
 * - power used: the known energy; null when none is known
 * - on target: the Performance page's average (availability × speed vs each machine's own target)
 */
export function overviewFigures({
  availability,
  production,
  energy,
  performance,
}: {
  availability: Pick<AvailabilityMachine, 'availability_percent'>[];
  production: Pick<ProductionMachine, 'units_produced' | 'status' | 'unit_label'>[];
  energy: Pick<EnergyMachine, 'energy_kwh'>[];
  performance: Pick<PerformanceMachine, 'performance_percent'>[];
}) {
  const counted = production.filter((m) => unitsMade(m) !== null);
  const kwh = energy.map((m) => knownNumber(m.energy_kwh)).filter((v): v is number => v !== null);
  return {
    runningPercent: averageKnown(availability.map((m) => m.availability_percent)),
    units: counted.length > 0 ? sumUnits(counted) : null,
    unitLabel: sharedUnitLabel(production),
    kwh: kwh.length > 0 ? Math.round(kwh.reduce((s, v) => s + v, 0) * 100) / 100 : null,
    onTargetPercent: averageKnown(performance.map((m) => m.performance_percent)),
  };
}
