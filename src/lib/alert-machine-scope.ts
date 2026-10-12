/** Shared line / machine filter for availability alert rows. */
export function machineInAlertScope(
  machine: { line_id: string; machine_id: string },
  lineFilter: string,
  machineFilter: string,
): boolean {
  if (lineFilter && machine.line_id !== lineFilter) return false;
  if (machineFilter && machine.machine_id !== machineFilter) return false;
  return true;
}
