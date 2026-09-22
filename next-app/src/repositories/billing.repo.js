/**
 * Bills and customer payments.
 *
 * `recalculatePaidAmount` is the important one: it recomputes a bill's paid
 * total as a SUM over verified payments rather than incrementing a counter. That
 * makes verification idempotent — verifying the same payment twice is a no-op
 * instead of silently doubling the credit, which the previous system did.
 */

import 'server-only';
import { and, eq, desc, asc, sql, inArray } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { monthlyBills, payments, users, milkmanProfiles } from '@/db/schema/index.js';
import { PERMISSIONS } from '@/auth/roles.js';
import { scoped, paginate } from './base.js';

const billScope = { tenant: monthlyBills.milkmanId, owner: monthlyBills.customerId };
const paymentScope = { tenant: payments.milkmanId, owner: payments.customerId };

// ── Bills ────────────────────────────────────────────────────────────────────

export async function findBill(actor, { customerId, month }) {
  const [row] = await db
    .select()
    .from(monthlyBills)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.BILL_READ, columns: billScope },
        eq(monthlyBills.customerId, customerId),
        eq(monthlyBills.month, month),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findBillById(actor, id) {
  const [row] = await db
    .select()
    .from(monthlyBills)
    .where(
      scoped({ actor, permission: PERMISSIONS.BILL_READ, columns: billScope }, eq(monthlyBills.id, id)),
    )
    .limit(1);
  return row ?? null;
}

/** Invoice history, newest month first. */
export async function listBills(actor, { customerId, ...page } = {}) {
  const { limit, offset } = paginate(page, 36);
  return db
    .select()
    .from(monthlyBills)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.BILL_READ, columns: billScope },
        customerId ? eq(monthlyBills.customerId, customerId) : undefined,
      ),
    )
    .orderBy(desc(monthlyBills.month))
    .limit(limit)
    .offset(offset);
}

/**
 * Create the bill row for a month if it does not exist, then return it.
 *
 * The unique index on (customer_id, month) makes this safe under concurrency —
 * two simultaneous requests cannot produce two bills for one month, which the
 * old schema permitted while reading with `.maybeSingle()` (which throws on two).
 */
export async function ensureBill(tx, { customerId, milkmanId, month, dueDate }) {
  const [row] = await tx
    .insert(monthlyBills)
    .values({ customerId, milkmanId, month, dueDate, status: 'OPEN' })
    .onConflictDoNothing({ target: [monthlyBills.customerId, monthlyBills.month] })
    .returning();

  if (row) return row;

  const [existing] = await tx
    .select()
    .from(monthlyBills)
    .where(and(eq(monthlyBills.customerId, customerId), eq(monthlyBills.month, month)))
    .limit(1);
  return existing;
}

/** Write computed figures onto a bill. Used by live recompute and month-close. */
export async function updateBillTotals(tx, { billId, totals }) {
  const [row] = await tx
    .update(monthlyBills)
    .set({ ...totals, updatedAt: new Date() })
    .where(eq(monthlyBills.id, billId))
    .returning();
  return row ?? null;
}

/**
 * Recompute `paidAmount` from verified payments, and derive the status.
 * Idempotent by construction.
 */
export async function recalculatePaidAmount(tx, billId) {
  const [totals] = await tx
    .select({
      paid: sql`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'VERIFIED'), 0)`,
    })
    .from(payments)
    .where(eq(payments.billId, billId));

  const [row] = await tx
    .update(monthlyBills)
    .set({
      paidAmount: totals.paid,
      status: sql`case
        when ${monthlyBills.closedAt} is null then 'OPEN'
        when ${totals.paid} >= ${monthlyBills.totalAmount} then 'PAID'
        when ${totals.paid} > 0 then 'PARTIALLY_PAID'
        when ${monthlyBills.dueDate} < current_date then 'OVERDUE'
        else 'UNPAID'
      end`,
      paidAt: sql`case
        when ${totals.paid} >= ${monthlyBills.totalAmount} and ${monthlyBills.totalAmount} > 0
        then coalesce(${monthlyBills.paidAt}, now())
        else ${monthlyBills.paidAt}
      end`,
      updatedAt: new Date(),
    })
    .where(eq(monthlyBills.id, billId))
    .returning();

  return row ?? null;
}

/** Outstanding balances across a milkman's book — the collections view. */
export async function listOutstanding(actor, page = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select({
      billId: monthlyBills.id,
      customerId: monthlyBills.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      month: monthlyBills.month,
      totalAmount: monthlyBills.totalAmount,
      paidAmount: monthlyBills.paidAmount,
      balance: sql`${monthlyBills.totalAmount} - ${monthlyBills.paidAmount}`.as('balance'),
      status: monthlyBills.status,
      dueDate: monthlyBills.dueDate,
    })
    .from(monthlyBills)
    .innerJoin(users, eq(users.id, monthlyBills.customerId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.BILL_READ, columns: billScope },
        sql`${monthlyBills.totalAmount} > ${monthlyBills.paidAmount}`,
        inArray(monthlyBills.status, ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE']),
      ),
    )
    .orderBy(desc(sql`balance`))
    .limit(limit)
    .offset(offset);
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function createPayment(tx, values) {
  const [row] = await tx.insert(payments).values(values).returning();
  return row;
}

/** Payments against one bill — the ledger shown on the invoice. */
export async function listForBill(actor, billId) {
  return db
    .select()
    .from(payments)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PAYMENT_READ, columns: paymentScope },
        eq(payments.billId, billId),
      ),
    )
    .orderBy(asc(payments.createdAt));
}

/** The milkman's verification queue. */
export async function listSubmitted(actor, page = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select({
      id: payments.id,
      billId: payments.billId,
      customerId: payments.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      month: monthlyBills.month,
      amount: payments.amount,
      method: payments.method,
      reference: payments.reference,
      customerNote: payments.customerNote,
      status: payments.status,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.customerId))
    .innerJoin(monthlyBills, eq(monthlyBills.id, payments.billId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PAYMENT_READ, columns: paymentScope },
        eq(payments.status, 'SUBMITTED'),
      ),
    )
    .orderBy(asc(payments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function findPayment(actor, id) {
  const [row] = await db
    .select()
    .from(payments)
    .where(
      scoped({ actor, permission: PERMISSIONS.PAYMENT_READ, columns: paymentScope }, eq(payments.id, id)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Move a payment to VERIFIED or REJECTED.
 *
 * The `status = 'SUBMITTED'` predicate makes the transition one-way: a second
 * verification of the same payment affects zero rows.
 */
export async function resolvePayment(tx, actor, { id, status, rejectionReason }) {
  const [row] = await tx
    .update(payments)
    .set({
      status,
      rejectionReason: rejectionReason ?? null,
      verifiedBy: actor.userId,
      verifiedAt: status === 'VERIFIED' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PAYMENT_VERIFY, columns: paymentScope },
        eq(payments.id, id),
        eq(payments.status, 'SUBMITTED'),
      ),
    )
    .returning();
  return row ?? null;
}

/** Count of payments waiting on the milkman — nav badge. */
export async function countSubmitted(actor) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(payments)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.PAYMENT_READ, columns: paymentScope },
        eq(payments.status, 'SUBMITTED'),
      ),
    );
  return row?.count ?? 0;
}
