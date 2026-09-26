/**
 * The billing engine.
 *
 * One pure function — `computeBill` — takes plain rows and returns a complete
 * bill. No database, no network, no clock beyond what is passed in. That makes
 * it exhaustively testable, and it makes the customer's invoice and the
 * milkman's earnings provably consistent, because both call it.
 *
 * ## The rule
 *
 * A customer pays for **litres actually delivered**, not days subscribed.
 * Skipped and undelivered days cost nothing. Extra product orders are added on
 * top. That is the product's fairness promise and the whole of the calculation.
 *
 * ## What changed from the previous implementation
 *
 * · **Every** subscription is billed, not just the most recently created one.
 *   The old `LIMIT 1` under-charged every multi-plan customer.
 * · Payments are scoped to the bill they belong to, so a customer who has paid
 *   six months does not appear to have pre-paid the seventh.
 * · Amounts come from the delivery row's own frozen `unitPrice`, so a later
 *   plan edit cannot retroactively change a delivered month.
 * · Cancelled purchases are excluded, and the month range is half-open, so
 *   orders placed on the last day of the month are counted.
 * · All arithmetic is integer paise.
 */

import { toPaise, toMilli, lineAmountPaise, sum, atLeastZero } from './money.js';
import { monthStart, monthEnd, daysInMonth, assertMonth } from './dates.js';

/**
 * @typedef {object} DeliveryRow
 * @property {string} subscriptionRootId
 * @property {string} deliveryDate      'YYYY-MM-DD'
 * @property {string} status            PENDING | DELIVERED | UNDELIVERED | SKIPPED | CANCELLED
 * @property {string} productName
 * @property {string} unit
 * @property {string|number} plannedQuantity
 * @property {string|number|null} adjustedQuantity
 * @property {string|number|null} deliveredQuantity
 * @property {string|number} unitPrice
 * @property {string|null} [skipReason]
 */

/**
 * @typedef {object} PurchaseRow
 * @property {string} id
 * @property {string} productName
 * @property {string} unit
 * @property {string|number} quantity
 * @property {string|number} unitPrice
 * @property {string} orderDate         'YYYY-MM-DD'
 * @property {string} status            PENDING | ACCEPTED | DELIVERED | CANCELLED
 */

/**
 * @typedef {object} PaymentRow
 * @property {string} id
 * @property {string|number} amount
 * @property {string} status            SUBMITTED | VERIFIED | REJECTED | REFUNDED
 * @property {string} [method]
 * @property {string|null} [reference]
 * @property {string|Date|null} [verifiedAt]
 * @property {string|Date} createdAt
 */

/** Statuses that count as money received. Exactly one — no synonyms. */
const PAID_STATUSES = new Set(['VERIFIED']);
/** Statuses awaiting the milkman's confirmation. */
const PENDING_STATUSES = new Set(['SUBMITTED']);
/** Purchases that do not bill. */
const VOID_PURCHASE_STATUSES = new Set(['CANCELLED']);

/**
 * Compute a customer's bill for one month.
 *
 * @param {object} input
 * @param {string} input.month                  'YYYY-MM'
 * @param {DeliveryRow[]} input.deliveries      every delivery in the month
 * @param {PurchaseRow[]} input.purchases       every purchase in the month
 * @param {PaymentRow[]} input.payments         payments against *this* bill only
 * @param {string|number} [input.adjustmentAmount]  milkman credit, in rupees
 * @param {string|null} [input.adjustmentReason]
 * @returns {BillResult}
 */
export function computeBill({
  month,
  deliveries = [],
  purchases = [],
  payments = [],
  adjustmentAmount = 0,
  adjustmentReason = null,
}) {
  assertMonth(month);

  // ── Milk ───────────────────────────────────────────────────────────────────
  // Group by subscription so a multi-plan customer gets one line per plan, and
  // so the sum of the lines provably equals the total.
  const bySubscription = new Map();

  for (const delivery of deliveries) {
    const key = delivery.subscriptionRootId;
    if (!bySubscription.has(key)) {
      bySubscription.set(key, {
        subscriptionRootId: key,
        productName: delivery.productName,
        unit: delivery.unit,
        unitPrice: String(delivery.unitPrice),
        deliveredDays: 0,
        skippedDays: 0,
        undeliveredDays: 0,
        pendingDays: 0,
        deliveredMilli: 0,
        /** Planned units across the days that were actually delivered. */
        plannedDeliveredMilli: 0,
        /** Planned units still outstanding this month. */
        plannedPendingMilli: 0,
        amountPaise: 0,
      });
    }
    const line = bySubscription.get(key);

    // What *should* have arrived that day: a one-day adjustment if the customer
    // made one, otherwise the subscription's standard quantity.
    const expectedMilli = toMilli(delivery.adjustedQuantity ?? delivery.plannedQuantity);

    switch (delivery.status) {
      case 'DELIVERED': {
        const actualMilli = toMilli(delivery.deliveredQuantity ?? 0);
        line.deliveredDays += 1;
        line.deliveredMilli += actualMilli;
        line.plannedDeliveredMilli += expectedMilli;
        line.amountPaise += lineAmountPaise(actualMilli, delivery.unitPrice);
        break;
      }
      case 'SKIPPED':
        line.skippedDays += 1;
        break;
      case 'UNDELIVERED':
        line.undeliveredDays += 1;
        break;
      case 'PENDING':
        line.pendingDays += 1;
        line.plannedPendingMilli += expectedMilli;
        break;
      case 'CANCELLED':
      default:
        break;
    }
  }

  const milkLines = [...bySubscription.values()].map((line) => ({
    ...line,
    /**
     * Net difference between what arrived and what the plan called for, over the
     * delivered days only. Well-defined because both sides count the same days.
     * The gross per-day split lives in `computeVariance`.
     */
    varianceMilli: line.deliveredMilli - line.plannedDeliveredMilli,
  }));

  const milkAmountPaise = sum(milkLines.map((l) => l.amountPaise));

  // ── Products ───────────────────────────────────────────────────────────────
  const billablePurchases = purchases.filter((p) => !VOID_PURCHASE_STATUSES.has(p.status));

  const productLines = billablePurchases.map((purchase) => ({
    id: purchase.id,
    productName: purchase.productName,
    unit: purchase.unit,
    quantityMilli: toMilli(purchase.quantity),
    unitPricePaise: toPaise(purchase.unitPrice),
    orderDate: purchase.orderDate,
    status: purchase.status,
    amountPaise: lineAmountPaise(toMilli(purchase.quantity), purchase.unitPrice),
  }));

  const productsAmountPaise = sum(productLines.map((l) => l.amountPaise));

  // ── Totals ─────────────────────────────────────────────────────────────────
  const adjustmentPaise = toPaise(adjustmentAmount);
  const totalPaise = atLeastZero(milkAmountPaise + productsAmountPaise - adjustmentPaise);

  // ── Settlement ─────────────────────────────────────────────────────────────
  // `payments` must already be scoped to this bill. Summing a customer's entire
  // payment history against one month is the bug this signature prevents.
  const verified = payments.filter((p) => PAID_STATUSES.has(p.status));
  const awaiting = payments.filter((p) => PENDING_STATUSES.has(p.status));

  const paidPaise = sum(verified.map((p) => toPaise(p.amount)));
  const awaitingPaise = sum(awaiting.map((p) => toPaise(p.amount)));

  const balancePaise = atLeastZero(totalPaise - paidPaise);
  const creditPaise = atLeastZero(paidPaise - totalPaise);

  // ── Counters ───────────────────────────────────────────────────────────────
  const deliveredDays = sum(milkLines.map((l) => l.deliveredDays));
  const skippedDays = sum(milkLines.map((l) => l.skippedDays));
  const undeliveredDays = sum(milkLines.map((l) => l.undeliveredDays));
  const pendingDays = sum(milkLines.map((l) => l.pendingDays));
  const deliveredMilli = sum(milkLines.map((l) => l.deliveredMilli));

  return {
    month,
    periodStart: monthStart(month),
    periodEnd: monthEnd(month),
    daysInMonth: daysInMonth(month),

    milkLines,
    milkAmountPaise,

    productLines,
    productsAmountPaise,

    adjustmentPaise,
    adjustmentReason,
    totalPaise,

    paidPaise,
    awaitingPaise,
    balancePaise,
    creditPaise,

    status: settlementStatus({ totalPaise, paidPaise, awaitingPaise, pendingDays }),

    deliveredDays,
    skippedDays,
    undeliveredDays,
    pendingDays,
    deliveredMilli,
  };
}

/**
 * Settlement state, derived — never hand-set.
 *
 * OPEN while the month still has unactioned deliveries, because the total can
 * still move. Only a settled month can be PAID.
 */
function settlementStatus({ totalPaise, paidPaise, awaitingPaise, pendingDays }) {
  if (pendingDays > 0) return 'OPEN';
  if (totalPaise === 0) return 'PAID';
  if (paidPaise >= totalPaise) return 'PAID';
  if (paidPaise > 0) return 'PARTIALLY_PAID';
  if (awaitingPaise > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
}

/**
 * Per-day variance against the plan — the "extra milk" figure shown in history.
 *
 * Deliberately **gross**: a day 0.5 L over and a day 0.5 L under report as
 * 0.5 extra and 0.5 reduced, not as zero. The previous system computed a net
 * figure on the invoice and a gross figure in history, so the same customer saw
 * two different numbers for the same month. One definition, used in both places.
 *
 * @param {DeliveryRow[]} deliveries
 */
export function computeVariance(deliveries) {
  let extraMilli = 0;
  let reducedMilli = 0;

  for (const delivery of deliveries) {
    if (delivery.status === 'CANCELLED') continue;

    const planned = toMilli(delivery.plannedQuantity ?? 0);

    if (delivery.status === 'DELIVERED') {
      const actual = toMilli(delivery.deliveredQuantity ?? 0);
      const difference = actual - planned;
      if (difference > 0) extraMilli += difference;
      else if (difference < 0) reducedMilli += -difference;
    } else if (delivery.status === 'SKIPPED' || delivery.status === 'UNDELIVERED') {
      reducedMilli += planned;
    }
  }

  return { extraMilli, reducedMilli, netMilli: extraMilli - reducedMilli };
}

/**
 * Milkman earnings over a set of deliveries and purchases.
 *
 * Reads the same frozen `unitPrice` and the same `amount` semantics the customer
 * bill uses, so the two sides reconcile by construction. The previous system had
 * a separate implementation with different constants and they never agreed.
 *
 * @param {object} input
 * @param {DeliveryRow[]} input.deliveries
 * @param {PurchaseRow[]} input.purchases
 * @param {PaymentRow[]} input.payments
 */
export function computeEarnings({ deliveries = [], purchases = [], payments = [] }) {
  const milkPaise = sum(
    deliveries
      .filter((d) => d.status === 'DELIVERED')
      .map((d) => lineAmountPaise(toMilli(d.deliveredQuantity ?? 0), d.unitPrice)),
  );

  const productsPaise = sum(
    purchases
      .filter((p) => !VOID_PURCHASE_STATUSES.has(p.status))
      .map((p) => lineAmountPaise(toMilli(p.quantity), p.unitPrice)),
  );

  const billedPaise = milkPaise + productsPaise;
  const collectedPaise = sum(
    payments.filter((p) => PAID_STATUSES.has(p.status)).map((p) => toPaise(p.amount)),
  );

  return {
    milkPaise,
    productsPaise,
    billedPaise,
    collectedPaise,
    outstandingPaise: atLeastZero(billedPaise - collectedPaise),
    deliveredCount: deliveries.filter((d) => d.status === 'DELIVERED').length,
    purchaseCount: purchases.filter((p) => !VOID_PURCHASE_STATUSES.has(p.status)).length,
  };
}

/**
 * The same figures as `computeEarnings`, split per customer.
 *
 * Every row must carry a `customerId`. The arithmetic is `computeEarnings`
 * applied to each customer's own rows, so the per-customer lines sum to the
 * month's totals exactly — there is no second formula to drift.
 *
 * Also carries `milkMilli`, the litres actually delivered, because "₹372 of
 * milk" means little on a round without "12.4 L" beside it.
 *
 * @returns {Array<{customerId: string, milkMilli: number} & ReturnType<typeof computeEarnings>>}
 *   sorted by billed amount, largest first
 */
export function computeEarningsByCustomer({ deliveries = [], purchases = [], payments = [] }) {
  const groups = new Map();
  const group = (customerId) => {
    let entry = groups.get(customerId);
    if (!entry) {
      entry = { deliveries: [], purchases: [], payments: [] };
      groups.set(customerId, entry);
    }
    return entry;
  };

  for (const row of deliveries) group(row.customerId).deliveries.push(row);
  for (const row of purchases) group(row.customerId).purchases.push(row);
  for (const row of payments) group(row.customerId).payments.push(row);

  return [...groups]
    .map(([customerId, rows]) => ({
      customerId,
      ...computeEarnings(rows),
      milkMilli: sum(
        rows.deliveries
          .filter((d) => d.status === 'DELIVERED')
          .map((d) => toMilli(d.deliveredQuantity ?? 0)),
      ),
    }))
    .sort((a, b) => b.billedPaise - a.billedPaise);
}
