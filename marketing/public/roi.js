// The ROI calculator page: reads the form on every change and writes the figures (roi-calc.js).
import { formatNumber, formatRupees, parseNumber, roiFigures } from './roi-calc.js';

const form = document.getElementById('roi-form');
const $ = (id) => document.getElementById(id);
const read = (id) => parseNumber($(id).value);
const optional = (id) => {
  const v = $(id).value.trim();
  return v === '' ? null : parseNumber(v);
};

function show(id, text) {
  $(id).textContent = text;
}

function update() {
  const figures = roiFigures({
    machines: read('machines'),
    stopHoursPerShift: read('stop-hours'),
    shiftsPerDay: read('shifts'),
    daysPerMonth: read('days'),
    valuePerHour: read('value'),
    winBackPct: read('win-back'),
    feePerMachine: optional('fee'),
    setupFee: optional('setup'),
  });
  const out = $('roi-out');
  if (!figures) {
    out.classList.add('is-waiting');
    show('out-hint', 'Fill in every field above with a number to see your figures.');
    return;
  }
  out.classList.remove('is-waiting');
  show('out-hint', '');
  show('out-stop-hours', `${formatNumber(figures.stopHours)} machine-hours`);
  show('out-lost', formatRupees(figures.lostRupees));
  show('out-win-pct', `${formatNumber(read('win-back'), 1)}%`);
  show('out-won-hours', `${formatNumber(figures.wonBackHours, 1)} machine-hours`);
  show('out-won-rupees', formatRupees(figures.wonBackRupees));
  show('out-break-even', formatRupees(figures.breakEvenFee));

  const withFee = $('out-with-fee');
  if (figures.fee == null) {
    withFee.hidden = true;
    return;
  }
  withFee.hidden = false;
  show('out-fee', formatRupees(figures.fee));
  show('out-net', formatRupees(figures.net));
  show('out-return', figures.returnMultiple == null ? '—' : `${formatNumber(figures.returnMultiple, 1)}×`);
  let payback;
  if (figures.paybackMonths == null) payback = 'Not at these figures: the fee is more than what is won back.';
  else if (figures.paybackMonths === 0) payback = 'No upfront cost: it pays from the first month.';
  else payback = `The setup fee is paid back in ${formatNumber(figures.paybackMonths, 1)} months.`;
  show('out-payback', payback);
}

form.addEventListener('input', update);
form.addEventListener('submit', (e) => e.preventDefault());
update();
