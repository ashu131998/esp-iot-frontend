import { describe, expect, it } from 'vitest';

import { SLICE_COLORS, sliceShares } from '@/components/charts/donut-chart';
import { lineEnergySlices, machineEnergySlices, reasonSlices, runShareSlices, timeSplitSlices } from '@/lib/pie-slices';

const t = (key: string, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), key);

describe('the pies', () => {
  it('machines by running time: the dashboard\'s 85 / 70 % cut-offs, no data apart, always all four', () => {
    expect(runShareSlices([92, 85, 84.9, 70, 69.9, null, undefined, Number.NaN], t)).toEqual([
      { label: 'Ran 85% or more', value: 2, color: SLICE_COLORS.good },
      { label: 'Ran 70–85%', value: 2, color: SLICE_COLORS.warn },
      { label: 'Ran under 70%', value: 1, color: SLICE_COLORS.bad },
      { label: 'No data', value: 3, color: SLICE_COLORS.idle },
    ]);
    expect(runShareSlices([], t).map((s) => s.value)).toEqual([0, 0, 0, 0]);
  });

  it('a period\'s time: ran against stood still, never negative', () => {
    expect(timeSplitSlices(90, 30, t)).toEqual([
      { label: 'Running', value: 90, color: SLICE_COLORS.good },
      { label: 'Stopped', value: 30, color: SLICE_COLORS.bad },
    ]);
    expect(timeSplitSlices(-5, 0, t).map((s) => s.value)).toEqual([0, 0]);
  });

  it('energy by line: summed per line, largest first, by name; nothing for lines without energy', () => {
    const machines = [
      { line_id: 'line-1', energy_kwh: 10.26 }, { line_id: 'line-2', energy_kwh: 30 }, { line_id: 'line-1', energy_kwh: 5 },
      { line_id: 'line-3', energy_kwh: null }, { line_id: 'line-4', energy_kwh: 0 },
    ];
    expect(lineEnergySlices(machines, (id) => ({ 'line-1': 'Weaving A', 'line-2': 'Weaving B' }[id] ?? id))).toEqual([
      { label: 'Weaving B', value: 30, color: SLICE_COLORS.series[0] },
      { label: 'Weaving A', value: 15.3, color: SLICE_COLORS.series[1] },
    ]);
  });

  it('energy by machine: the seven largest and the rest together', () => {
    const machines = Array.from({ length: 9 }, (_, i) => ({ machine_name: `M${i + 1}`, energy_kwh: 10 * (i + 1) }));
    const slices = machineEnergySlices([...machines, { machine_name: 'Idle', energy_kwh: null }], t);
    expect(slices.map((s) => [s.label, s.value])).toEqual([
      ['M9', 90], ['M8', 80], ['M7', 70], ['M6', 60], ['M5', 50], ['M4', 40], ['M3', 30], ['Other machines', 30],
    ]);
    expect(machineEnergySlices([{ machine_name: 'A', energy_kwh: 0 }], t)).toEqual([]);
  });

  it('stops by reason: the top five and the rest together; no reason is a reason', () => {
    const reasons = [
      { label: 'Yarn breakage', stops: 120 }, { label: null, stops: 40 }, { label: 'Power', stops: 30 }, { label: 'Maintenance', stops: 20 },
      { label: 'Operator', stops: 10 }, { label: 'Cleaning', stops: 8 }, { label: 'Tool change', stops: 2 }, { label: 'Never', stops: 0 },
    ];
    const slices = reasonSlices(reasons, t);
    expect(slices.map((s) => [s.label, s.value])).toEqual([
      ['Yarn breakage', 120], ['No reason given', 40], ['Power', 30], ['Maintenance', 20], ['Operator', 10], ['Other reasons', 10],
    ]);
    expect(slices.at(-1)?.color).toBe(SLICE_COLORS.idle);
    expect(reasonSlices([], t)).toEqual([]);
  });

  it('shares add up to 100 and are 0 when nothing was measured', () => {
    expect(sliceShares([{ label: 'a', value: 1, color: '' }, { label: 'b', value: 3, color: '' }])).toEqual([25, 75]);
    expect(sliceShares([{ label: 'a', value: 0, color: '' }])).toEqual([0]);
  });
});
