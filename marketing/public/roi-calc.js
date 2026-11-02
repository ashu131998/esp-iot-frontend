/**
 * The ROI calculator's arithmetic (roi.html), kept apart from the page so it is unit-tested
 * (src/roi-calc.test.ts). Plain numbers in, plain numbers out; the page formats them.
 *
 * Stop hours a month = machines × stop hours per machine per shift × shifts a day × working days.
 * Won back = stop hours × the share the factory expects to win back (its own guess).
 * The service pays for itself at any fee per machine below won-back rupees ÷ machines.
 */

/** @typedef {{ machines: number, stopHoursPerShift: number, shiftsPerDay: number, daysPerMonth: number,
 *   valuePerHour: number, winBackPct: number, feePerMachine?: number | null, setupFee?: number | null }} RoiInputs */

/**
 * @typedef {{ stopHours: number, lostRupees: number, wonBackHours: number, wonBackRupees: number,
 *   breakEvenFee: number | null, fee: number | null, net: number | null, returnMultiple: number | null,
 *   paybackMonths: number | null }} RoiFigures
 */

/**
 * A number from a form field: "1,250" → 1250, "₹ 300" → 300; NaN when it is not one.
 * @param {string | null | undefined} text
 * @returns {number}
 */
export function parseNumber(text) {
  const clean = String(text ?? '').replace(/[,\s₹]/g, '');
  if (clean === '') return Number.NaN;
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

/**
 * @param {RoiInputs} input
 * @returns {RoiFigures | null} null while an input is missing or out of range
 */
export function roiFigures(input) {
  const { machines, stopHoursPerShift, shiftsPerDay, daysPerMonth, valuePerHour, winBackPct } = input;
  /** @type {(v: number, max: number) => boolean} */
  const ok = (v, max) => Number.isFinite(v) && v >= 0 && v <= max;
  if (!ok(machines, 100000) || machines < 1) return null;
  if (!ok(shiftsPerDay, 3) || shiftsPerDay < 1) return null;
  if (!ok(stopHoursPerShift, 24 / shiftsPerDay)) return null;
  if (!ok(daysPerMonth, 31) || daysPerMonth < 1) return null;
  if (!ok(valuePerHour, 1000000)) return null;
  if (!ok(winBackPct, 100)) return null;

  const stopHours = machines * stopHoursPerShift * shiftsPerDay * daysPerMonth;
  const wonBackHours = stopHours * (winBackPct / 100);
  const wonBackRupees = wonBackHours * valuePerHour;
  const feePer = input.feePerMachine != null && Number.isFinite(input.feePerMachine) && input.feePerMachine >= 0
    ? input.feePerMachine
    : null;
  const fee = feePer != null ? feePer * machines : null;
  const net = fee != null ? wonBackRupees - fee : null;
  const setup = input.setupFee != null && Number.isFinite(input.setupFee) && input.setupFee > 0 ? input.setupFee : 0;
  let paybackMonths = null;
  if (net != null && net > 0) paybackMonths = setup > 0 ? setup / net : 0;
  return {
    stopHours,
    lostRupees: stopHours * valuePerHour,
    wonBackHours,
    wonBackRupees,
    breakEvenFee: wonBackRupees / machines,
    fee,
    net,
    returnMultiple: fee != null && fee > 0 ? wonBackRupees / fee : null,
    paybackMonths,
  };
}

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/**
 * "₹1,44,000" (Indian grouping), "−₹1,200".
 * @param {number} value
 * @returns {string}
 */
export function formatRupees(value) {
  if (!Number.isFinite(value)) return '—';
  const size = Math.round(Math.abs(value));
  return `${value < 0 && size > 0 ? '−' : ''}₹${whole.format(size)}`;
}

/**
 * "1,248" or "12.5" (hours, multiples, months).
 * @param {number} value
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return (decimals > 0 ? oneDecimal : whole).format(value);
}
