/**
 * Money and quantity arithmetic.
 *
 * Rupee amounts are held as **integer paise** and litre quantities as **integer
 * millilitres** for the whole of any calculation. Only the boundaries — reading
 * from Postgres `numeric`, writing back, rendering — convert to and from decimal
 * strings.
 *
 * The reason is ordinary binary floating point: `0.1 + 0.2 === 0.30000000000000004`.
 * The previous system summed rupee floats across a month and rounded at the end,
 * so a long month of half-litre deliveries could land a paisa or two off and a
 * bill would never quite equal the sum of its own line items. Integer arithmetic
 * removes the question entirely.
 *
 * Pure module — no I/O, no framework. Trivially unit-testable.
 */

/** Paise per rupee. */
const PAISE = 100;
/** Millilitres per litre. Quantities carry 3 decimal places. */
const MILLI = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a decimal value into integer minor units without ever touching a float.
 *
 * Accepts what Postgres `numeric` gives us (a string), plus numbers and null.
 * Extra decimal places are truncated toward zero rather than rounded, so parsing
 * can never invent money that was not there.
 *
 * @param {string|number|null|undefined} value
 * @param {number} scale  decimal places in the minor unit (2 for paise, 3 for ml)
 * @returns {number} integer minor units
 */
function parseToMinor(value, scale) {
  if (value === null || value === undefined || value === '') return 0;

  const text = String(value).trim();
  if (!/^-?\d*(\.\d*)?$/.test(text)) {
    throw new TypeError(`Not a decimal value: ${JSON.stringify(value)}`);
  }

  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole = '0', fraction = ''] = unsigned.split('.');

  const padded = (fraction + '0'.repeat(scale)).slice(0, scale);
  const minor = Number(whole) * 10 ** scale + Number(padded || '0');

  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Value out of safe range: ${value}`);
  }
  return negative ? -minor : minor;
}

function formatFromMinor(minor, scale) {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 10 ** scale);
  const fraction = String(abs % 10 ** scale).padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rupees ⇄ paise
// ─────────────────────────────────────────────────────────────────────────────

/** Decimal rupees (string or number) → integer paise. */
export function toPaise(value) {
  return parseToMinor(value, 2);
}

/** Integer paise → a decimal string safe to store in `numeric(12,2)`. */
export function paiseToDecimal(paise) {
  return formatFromMinor(Math.round(paise), 2);
}

/** Integer paise → a JS number of rupees, for display only. */
export function paiseToRupees(paise) {
  return Math.round(paise) / PAISE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Litres ⇄ millilitres
// ─────────────────────────────────────────────────────────────────────────────

/** Decimal litres → integer millilitres. */
export function toMilli(value) {
  return parseToMinor(value, 3);
}

/** Integer millilitres → a decimal string safe to store in `numeric(10,3)`. */
export function milliToDecimal(milli) {
  return formatFromMinor(Math.round(milli), 3);
}

/** Integer millilitres → a JS number of litres, for display only. */
export function milliToLitres(milli) {
  return Math.round(milli) / MILLI;
}

// ─────────────────────────────────────────────────────────────────────────────
// Arithmetic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Money owed for a quantity at a unit price.
 *
 * `unitPrice` carries 4 decimal places (`numeric(12,4)`) because a monthly price
 * divided by a month rarely lands on a whole paisa — ₹1800 ÷ 31 days ÷ 1 L is
 * ₹58.0645 per litre. Keeping that precision on the subscription and rounding
 * once, here, at the line level, is what makes a bill equal the sum of its lines.
 *
 * @param {number} milli      quantity in millilitres
 * @param {string|number} unitPrice  ₹ per unit, up to 4 dp
 * @returns {number} integer paise, half-up rounded
 */
export function lineAmountPaise(milli, unitPrice) {
  // unitPrice in ten-thousandths of a rupee
  const priceTenThousandths = parseToMinor(unitPrice, 4);
  // milli × tenThousandths ⇒ scale 3 + 4 = 7; paise is scale 2, so divide by 10^5
  const product = milli * priceTenThousandths;
  return roundHalfUp(product, 100_000);
}

/**
 * Divide, rounding half away from zero.
 *
 * `Math.round` rounds half *up* toward +∞, which biases negative values. Money
 * should round symmetrically: -0.5 → -1, not 0.
 */
export function roundHalfUp(numerator, denominator) {
  const sign = Math.sign(numerator) || 1;
  return sign * Math.round(Math.abs(numerator) / denominator);
}

/** Sum integer minor units. Present so call sites read as intent, not plumbing. */
export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

/** Clamp to zero. Bills, balances and stock are never negative. */
export function atLeastZero(minor) {
  return minor > 0 ? minor : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentation
// ─────────────────────────────────────────────────────────────────────────────

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format paise as Indian currency: ₹1,80,000.00 — lakh grouping, not thousands.
 * @param {number} paise
 * @param {{ whole?: boolean }} [options] drop the decimals when they are .00
 */
export function formatPaise(paise, options = {}) {
  const rupees = paiseToRupees(paise);
  if (options.whole && Number.isInteger(rupees)) return INR_WHOLE.format(rupees);
  return INR.format(rupees);
}

/** Format millilitres as "1.5 L" — trailing zeros trimmed. */
export function formatMilli(milli, unit = 'L') {
  const litres = milliToLitres(milli);
  const text = Number.isInteger(litres) ? String(litres) : String(Number(litres.toFixed(3)));
  return `${text} ${unit}`;
}
