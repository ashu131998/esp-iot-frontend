/** Display/sort key: registry `name` or metric row `machine_name`. */
export function machineSortKey(m: {
  machine_id: string;
  name?: string;
  machine_name?: string;
}): string {
  return m.name ?? m.machine_name ?? m.machine_id;
}

const LOCALE = 'en';
const NATURAL = { sensitivity: 'base' as const, numeric: true as const };

/**
 * Sort bucket: lowercase + natural numbers only.
 * "Loom 2" and "loom 2" share one bucket so they stay adjacent (not ASCII-separated).
 */
export function machineNameGroupKey(name: string): string {
  return name.toLocaleLowerCase(LOCALE).normalize('NFKC');
}

function firstLetterIsUppercase(name: string): boolean {
  const m = name.match(/\p{L}/u);
  if (!m) return false;
  const ch = m[0];
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

/**
 * Primary: group key order (never raw display-string / ASCII order).
 */
export function compareMachineNames(a: string, b: string): number {
  const ga = machineNameGroupKey(a);
  const gb = machineNameGroupKey(b);
  if (ga === gb) return 0;
  return ga.localeCompare(gb, LOCALE, NATURAL);
}

/** Same group only: "Loom" before "loom" (title letter), not ASCII code-point order. */
export function compareMachineNameCase(a: string, b: string): number {
  if (a === b) return 0;
  const au = firstLetterIsUppercase(a);
  const bu = firstLetterIsUppercase(b);
  if (au !== bu) return au ? -1 : 1;
  return 0;
}

export function compareMachineRecords<
  T extends { machine_id: string; name?: string; machine_name?: string },
>(x: T, y: T): number {
  const xa = machineSortKey(x);
  const ya = machineSortKey(y);
  const byName = compareMachineNames(xa, ya);
  if (byName !== 0) return byName;
  const byCase = compareMachineNameCase(xa, ya);
  if (byCase !== 0) return byCase;
  return x.machine_id.localeCompare(y.machine_id, LOCALE, { numeric: true });
}

export function sortByMachineName<
  T extends { machine_id: string; name?: string; machine_name?: string },
>(machines: T[]): T[] {
  return [...machines].sort(compareMachineRecords);
}
