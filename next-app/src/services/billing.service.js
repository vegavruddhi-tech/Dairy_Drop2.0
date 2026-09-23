/**
 * Billing use cases.
 *
 * The service reads rows, hands them to the pure engine in `@/domain/billing.js`,
 * and persists the result. It contains no arithmetic of its own — that is
 * deliberate, so every number in the product traces back to one tested function.
 *
 * A bill for the current month is recomputed on read. Once the month-close job
 * has stamped `closedAt`, the stored figures are returned as-is: a closed bill
 * is a financial record and must not silently change because a delivery was
 * edited afterwards.
 */

import 'server-only';

import { db, transaction } from '@/db/index.js';
import { computeBill, computeVariance, computeEarnings } from '@/domain/billing.js';
import { businessMonth, monthEnd, monthOf, businessDate } from '@/domain/dates.js';
import { paiseToDecimal, milliToDecimal, toPaise } from '@/domain/money.js';
import { NotFoundError, ForbiddenError } from '@/domain/errors.js';
import { PERMISSIONS } from '@/auth/roles.js';

import * as deliveriesRepo from '@/repositories/deliveries.repo.js';
import * as productsRepo from '@/repositories/products.repo.js';
import * as billingRepo from '@/repositories/billing.repo.js';
import * as usersRepo from '@/repositories/users.repo.js';

/**
 * Get a customer's bill for a month, recomputing it if the month is still open.
 *
 * @param {import('@/auth/session.js').ActorContext} actor
 * @param {object} options
 * @param {string} [options.customerId]  defaults to the actor (customer self-service)
 * @param {string} [options.month]       defaults to the current business month
 */
export async function getBill(actor, { customerId, month } = {}) {
  const targetCustomer = customerId ?? actor.userId;
  const targetMonth = month ?? businessMonth();

  // A customer may only read their own bill; the scope check inside the
  // repository enforces it, but fail early with a clearer message.
  if (!actor.can(PERMISSIONS.BILL_READ)) {
    throw new ForbiddenError('You cannot view bills.');
  }

  const customer = await usersRepo.findCustomer(actor, targetCustomer);
  if (!customer) throw new NotFoundError('That customer');

  const existing = await billingRepo.findBill(actor, {
    customerId: targetCustomer,
    month: targetMonth,
  });

  // A closed month is immutable.
  if (existing?.closedAt) {
    const paymentRows = await billingRepo.listForBill(actor, existing.id);
    return {
      ...toBillView(existing),
      payments: paymentRows,
      frozen: true,
      customer,
    };
  }

  const [deliveryRows, purchaseRows] = await Promise.all([
    deliveriesRepo.listForMonth(actor, { customerId: targetCustomer, month: targetMonth }),
    productsRepo.listForMonth(actor, { customerId: targetCustomer, month: targetMonth }),
  ]);

  const paymentRows = existing ? await billingRepo.listForBill(actor, existing.id) : [];

  const bill = computeBill({
    month: targetMonth,
    deliveries: deliveryRows,
    purchases: purchaseRows,
    payments: paymentRows,
    adjustmentAmount: existing?.adjustmentAmount ?? 0,
    adjustmentReason: existing?.adjustmentReason ?? null,
  });

  const variance = computeVariance(deliveryRows);

  return {
    ...bill,
    variance,
    deliveries: deliveryRows,
    payments: paymentRows,
    billId: existing?.id ?? null,
    dueDate: existing?.dueDate ?? monthEnd(targetMonth),
    frozen: false,
    customer,
  };
}

/**
 * Ensure a bill row exists for a month and bring its stored figures up to date.
 *
 * Called before a payment is recorded (a payment needs a bill to belong to) and
 * by the month-close job.
 */
export async function materialiseBill(tx, actor, { customerId, milkmanId, month }) {
  const bill = await billingRepo.ensureBill(tx, {
    customerId,
    milkmanId,
    month,
    dueDate: monthEnd(month),
  });

  const [deliveryRows, purchaseRows, paymentRows] = await Promise.all([
    deliveriesRepo.listForMonth(actor, { customerId, month }),
    productsRepo.listForMonth(actor, { customerId, month }),
    billingRepo.listForBill(actor, bill.id),
  ]);

  const computed = computeBill({
    month,
    deliveries: deliveryRows,
    purchases: purchaseRows,
    payments: paymentRows,
    adjustmentAmount: bill.adjustmentAmount ?? 0,
  });

  await billingRepo.updateBillTotals(tx, {
    billId: bill.id,
    totals: {
      milkAmount: paiseToDecimal(computed.milkAmountPaise),
      productsAmount: paiseToDecimal(computed.productsAmountPaise),
      deliveredDays: String(computed.deliveredDays),
      skippedDays: String(computed.skippedDays),
      totalQuantity: milliToDecimal(computed.deliveredMilli),
    },
  });

  return { bill, computed };
}

/**
 * Freeze a month. Idempotent — a bill that is already closed is left alone.
 * Run by the `close-month` job on the 1st.
 */
export async function closeMonth(actor, { customerId, milkmanId, month }) {
  return transaction(async (tx) => {
    const { bill, computed } = await materialiseBill(tx, actor, {
      customerId,
      milkmanId,
      month,
    });

    if (bill.closedAt) return bill;

    await billingRepo.updateBillTotals(tx, {
      billId: bill.id,
      totals: {
        closedAt: new Date(),
        status: computed.paidPaise >= computed.totalPaise ? 'PAID' : 'UNPAID',
      },
    });

    return billingRepo.recalculatePaidAmount(tx, bill.id);
  });
}

/** Invoice history for the customer's billing screen. */
export async function listInvoices(actor, { customerId, limit, offset } = {}) {
  const rows = await billingRepo.listBills(actor, {
    customerId: customerId ?? actor.userId,
    limit,
    offset,
  });
  return rows.map(toBillView);
}

/**
 * A milkman's earnings for a month.
 *
 * Uses the same engine as the customer bill, so the two reconcile by
 * construction rather than by coincidence.
 */
export async function getEarnings(actor, { month } = {}) {
  const targetMonth = month ?? businessMonth();

  const [deliveryRows, purchaseRows, outstanding, paymentRows] = await Promise.all([
    deliveriesRepo.listTenantMonth(actor, targetMonth),
    productsRepo.listTenantMonth(actor, targetMonth),
    billingRepo.listOutstanding(actor, { limit: 100 }),
    billingRepo.listPaymentsForMonth(actor, targetMonth),
  ]);

  const earnings = computeEarnings({
    deliveries: deliveryRows,
    purchases: purchaseRows,
    payments: [],
  });

  /*
   * Collections are the sum of VERIFIED payments against this month's bills.
   *
   * This used to sum `paidAmount` over `listOutstanding`, which returns only
   * bills that still owe money. A customer paying in full dropped off that list
   * and took their payment out of the total with them, so "Collected" fell as
   * more people paid and hit ₹0 once everyone had settled. It was also
   * unscoped by month, so any figure it did produce mixed months together.
   */
  const collected = paymentRows.filter((row) => row.status === 'VERIFIED');
  const collectedPaise = collected.reduce(
    (total, row) => total + toPaise(row.amount),
    0,
  );

  const byProduct = new Map();
  for (const purchase of purchaseRows) {
    if (purchase.status === 'CANCELLED') continue;
    const current = byProduct.get(purchase.productName) ?? { name: purchase.productName, paise: 0, count: 0 };
    current.paise += Math.round(Number(purchase.amount ?? 0) * 100);
    current.count += 1;
    byProduct.set(purchase.productName, current);
  }

  return {
    month: targetMonth,
    ...earnings,
    collectedPaise,
    // Outstanding is what was billed and not yet collected, floored at zero —
    // an advance payment is not negative debt.
    outstandingPaise: Math.max(0, earnings.billedPaise - collectedPaise),
    /** The month's collections ledger, newest first. Drives the history table. */
    payments: paymentRows.map((row) => ({
      id: row.id,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      amountPaise: toPaise(row.amount),
      method: row.method,
      reference: row.reference,
      status: row.status,
      rejectionReason: row.rejectionReason,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
    })),
    topProducts: [...byProduct.values()].sort((a, b) => b.paise - a.paise).slice(0, 5),
    outstanding,
  };
}

/** Map a stored bill row onto the shape the UI renders. */
function toBillView(row) {
  const totalPaise = Math.round(Number(row.totalAmount ?? 0) * 100);
  const paidPaise = Math.round(Number(row.paidAmount ?? 0) * 100);
  return {
    billId: row.id,
    month: row.month,
    milkAmountPaise: Math.round(Number(row.milkAmount ?? 0) * 100),
    productsAmountPaise: Math.round(Number(row.productsAmount ?? 0) * 100),
    adjustmentPaise: Math.round(Number(row.adjustmentAmount ?? 0) * 100),
    totalPaise,
    paidPaise,
    balancePaise: Math.max(0, totalPaise - paidPaise),
    creditPaise: Math.max(0, paidPaise - totalPaise),
    status: row.status,
    dueDate: row.dueDate,
    closedAt: row.closedAt,
    paidAt: row.paidAt,
    deliveredDays: Number(row.deliveredDays ?? 0),
    skippedDays: Number(row.skippedDays ?? 0),
    deliveredMilli: Math.round(Number(row.totalQuantity ?? 0) * 1000),
  };
}
