/**
 * Rate resolution and the delivery schedule.
 *
 * **One** rate function, used by the customer's bill and the milkman's earnings
 * alike. The previous system had three different ₹/litre fallbacks (65, 60 and
 * 75) and two different month lengths (the true count on one side, a hardcoded
 * 30 on the other), which is why a milkman's revenue could never equal the sum
 * of their customers' bills. There are no fallback rates here at all: a plan
 * must price itself, or it is not a valid plan.
 *
 * Pure module — no I/O.
 */

import { toPaise, toMilli, roundHalfUp } from './money.js';
import { daysInMonth, dayOfWeek, dayOfMonth, daysBetween } from './dates.js';

/**
 * Resolve a plan's rate into a **unit price** — ₹ per unit per delivery, carried
 * at 4 decimal places.
 *
 * A plan prices itself one of two ways, and exactly one is set (the database
 * enforces it):
 *
 *   · `pricePerDelivery` — an explicit per-drop price. Used as-is.
 *   · `monthlyPrice`     — divided by the true length of the reference month.
 *
 * Carrying 4 dp matters. ₹1800/month ÷ 31 days ÷ 1 L is ₹58.0645 per litre;
 * rounding that to paise before multiplying it back across 31 deliveries loses
 * about a rupee a month, every month, for every customer.
 *
 * @param {object} plan
 * @param {string|number|null} plan.pricePerDelivery
 * @param {string|number|null} plan.monthlyPrice
 * @param {string|number} plan.quantity   units per delivery
 * @param {string} referenceMonth         'YYYY-MM' — only used for monthly plans
 * @returns {{ unitPrice: string, perDeliveryPaise: number, basis: 'PER_DELIVERY'|'MONTHLY' }}
 */
export function resolveUnitPrice(plan, referenceMonth) {
  const quantityMilli = toMilli(plan.quantity);
  if (quantityMilli <= 0) {
    throw new RangeError('Plan quantity must be greater than zero.');
  }

  const hasPerDelivery =
    plan.pricePerDelivery !== null && plan.pricePerDelivery !== undefined && plan.pricePerDelivery !== '';
  const hasMonthly =
    plan.monthlyPrice !== null && plan.monthlyPrice !== undefined && plan.monthlyPrice !== '';

  if (hasPerDelivery === hasMonthly) {
    throw new Error(
      'A plan must set exactly one of pricePerDelivery or monthlyPrice. ' +
        'Ambiguous pricing was the root of the old billing mismatches.',
    );
  }

  // Round exactly once, at the end.
  //
  // Rounding to whole paise first and *then* deriving the per-unit rate throws
  // away the precision this design exists to keep: ₹1800 ÷ 31 is ₹58.0645, and
  // collapsing that to ₹58.06 before dividing by quantity loses about a rupee
  // per customer per month. Carry the full ratio, round at the boundary.
  //
  //   unitPrice(1e-4 ₹) = paise × 10^5 / (days × milli)
  //
  // Derivation: paise/100 ÷ (milli/1000 × days) × 10^4.
  let numerator;
  let denominator;
  let basis;

  if (hasPerDelivery) {
    numerator = toPaise(plan.pricePerDelivery) * 100_000;
    denominator = quantityMilli;
    basis = 'PER_DELIVERY';
  } else {
    numerator = toPaise(plan.monthlyPrice) * 100_000;
    // Divide by *drops*, not days. A "morning & evening" plan makes two drops a
    // day, so dividing a monthly price by days alone priced each drop at double
    // what the customer was quoted for the month.
    denominator =
      daysInMonth(referenceMonth) *
      deliveriesPerDay(plan.slot ?? 'MORNING') *
      quantityMilli;
    basis = 'MONTHLY';
  }

  if (!Number.isSafeInteger(numerator)) {
    throw new RangeError('Plan price is too large to price precisely.');
  }

  const unitPriceTenThousandths = roundHalfUp(numerator, denominator);

  // Display-only: what one delivery costs, rounded to paise. Never feeds the
  // unit price above.
  const perDeliveryPaise = roundHalfUp(unitPriceTenThousandths * quantityMilli, 100_000);

  return {
    unitPrice: formatTenThousandths(unitPriceTenThousandths),
    perDeliveryPaise,
    basis,
  };
}

function formatTenThousandths(value) {
  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Math.trunc(abs / 10_000);
  const fraction = String(abs % 10_000).padStart(4, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * How many drops a slot means in one delivery day.
 *
 * `BOTH` is two: a morning round and an evening round, each carrying the plan's
 * quantity. This was the missing factor everywhere — the schedule, the quote and
 * the generator all treated "morning & evening" as a single drop, so a customer
 * on two deliveries a day was quoted and billed for one.
 *
 * @param {string} slot MORNING | EVENING | BOTH
 */
export function deliveriesPerDay(slot) {
  switch (slot) {
    case 'MORNING':
    case 'EVENING':
      return 1;
    case 'BOTH':
      return 2;
    default:
      throw new RangeError(`Unknown delivery slot: ${slot}`);
  }
}

/**
 * The concrete delivery times a slot fills.
 *
 * `BOTH` is not a third time of day — it fills two. Treating it as its own
 * value is what let a customer hold a morning plan and a morning-and-evening
 * plan at once, which is two lots of milk arriving at one door at 6am.
 *
 * @param {string} slot MORNING | EVENING | BOTH
 * @returns {string[]}
 */
export function slotsOccupied(slot) {
  switch (slot) {
    case 'MORNING':
      return ['MORNING'];
    case 'EVENING':
      return ['EVENING'];
    case 'BOTH':
      return ['MORNING', 'EVENING'];
    default:
      throw new RangeError(`Unknown delivery slot: ${slot}`);
  }
}

/**
 * A product's identity, for deciding whether two orders are the same thing.
 *
 * `productName` is free text a milkman types, so "Cow Milk", "cow milk" and
 * "cow milk " are one product wearing three spellings. Normalising is the
 * pragmatic answer; the robust one is a product catalog plans reference by id,
 * at which point this function goes away.
 *
 * Known limit: a typo — "cowmilk" — reads as a different product and slips
 * through. The database keys on the same expression, so at least the two agree.
 */
export function productKey(name) {
  return String(name ?? '').trim().toLowerCase();
}

/**
 * Which of `wanted`'s times are already filled by the *same product*.
 *
 * A stop is one visit, not one item: a milkman arriving at 6am can hand over
 * cow milk and buffalo milk together. What cannot happen is the same product
 * twice at the same time — that is not two orders, it is one order written
 * down twice.
 *
 * Empty means the new plan fits alongside what the customer already has. Pure,
 * so the picker and the server decide identically — a rule implemented twice is
 * a rule that will disagree with itself.
 *
 * @param {{slot: string, productName: string}[]} held  current subscriptions
 * @param {{slot: string, productName: string}} wanted  the plan being added
 * @returns {string[]}  the clashing times, in morning-then-evening order
 */
export function clashingSlots(held, wanted) {
  const key = productKey(wanted.productName);
  const taken = new Set(
    held
      .filter((item) => productKey(item.productName) === key)
      .flatMap((item) => slotsOccupied(item.slot)),
  );
  return slotsOccupied(wanted.slot).filter((slot) => taken.has(slot));
}

/** 'MORNING' → 'morning'. For messages the customer reads. */
export function slotLabel(slot) {
  return String(slot).toLowerCase();
}

/**
 * What a full month on this plan would cost, for the quote shown at signup.
 * Presentational only — the real bill is always usage-based.
 */
export function quotedMonthlyPaise(plan, referenceMonth) {
  const { perDeliveryPaise } = resolveUnitPrice(plan, referenceMonth);
  return perDeliveryPaise * countDeliveries(plan, referenceMonth);
}

/**
 * Drops in a month: delivery days × drops per day.
 *
 * Takes the whole plan rather than a bare frequency, because the count depends
 * on the slot as well — and a signature that cannot see the slot is how the
 * slot came to be ignored.
 */
export function countDeliveries(plan, month) {
  return countDeliveryDays(plan.frequency, month) * deliveriesPerDay(plan.slot ?? 'MORNING');
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery schedule
//
// `frequency` was stored, displayed and then completely ignored by the previous
// system — every plan delivered daily regardless. Here it decides the schedule.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Should a delivery be generated for `date` under this subscription?
 *
 * Anchoring on `effectiveFrom` rather than on the calendar keeps alternate-day
 * and weekly plans stable across month boundaries: a Tuesday plan stays on
 * Tuesdays, and an alternate-day plan does not double up on the 1st.
 *
 * @param {string} frequency       DAILY | ALTERNATE_DAYS | WEEKLY | MONTHLY
 * @param {string} effectiveFrom   'YYYY-MM-DD' — the schedule anchor
 * @param {string} date            'YYYY-MM-DD' — the day in question
 */
export function isDeliveryDay(frequency, effectiveFrom, date) {
  if (date < effectiveFrom) return false;

  const elapsed = daysBetween(effectiveFrom, date);

  switch (frequency) {
    case 'DAILY':
      return true;
    case 'ALTERNATE_DAYS':
      return elapsed % 2 === 0;
    case 'WEEKLY':
      return dayOfWeek(date) === dayOfWeek(effectiveFrom);
    case 'MONTHLY':
      return dayOfMonth(date) === dayOfMonth(effectiveFrom);
    default:
      throw new RangeError(`Unknown frequency: ${frequency}`);
  }
}

/** How many deliveries a frequency yields in a month, for quoting. */
export function countDeliveryDays(frequency, month) {
  const days = daysInMonth(month);
  switch (frequency) {
    case 'DAILY':
      return days;
    case 'ALTERNATE_DAYS':
      return Math.ceil(days / 2);
    case 'WEEKLY':
      return 4;
    case 'MONTHLY':
      return 1;
    default:
      throw new RangeError(`Unknown frequency: ${frequency}`);
  }
}
