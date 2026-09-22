/**
 * Customer billing: the monthly bill and the payments against it.
 *
 * Two corrections to the old model drive the design here.
 *
 * 1. `payments.billId` is **NOT NULL**. The old system summed every payment a
 *    customer had ever made against a single month's bill, so from month two
 *    onward every month read "paid". A payment now belongs to exactly one bill
 *    and cannot be double-counted across months.
 *
 * 2. `paidAmount` is **derived**, never incremented. Verification recomputes it
 *    as a sum over verified payments, so verifying the same payment twice is a
 *    no-op instead of silently doubling the credit.
 */

import {
  uuid,
  text,
  varchar,
  timestamp,
  date,
  numeric,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';

import { pgTable } from './_schema.js';
import { sql } from 'drizzle-orm';

import { users } from './identity.js';
import { billStatusEnum, paymentStatusEnum, paymentMethodEnum } from './enums.js';

/**
 * One bill per customer per calendar month.
 *
 * The current month's bill is recomputed live on read; the month-close job then
 * freezes it. Both paths write the same columns, so a closed bill and a live one
 * are structurally identical.
 */
export const monthlyBills = pgTable(
  'monthly_bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 'YYYY-MM' in APP_TIMEZONE. */
    month: varchar('month', { length: 7 }).notNull(),

    // ── Components ───────────────────────────────────────────────────────────
    milkAmount: numeric('milk_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    productsAmount: numeric('products_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    /** Milkman-applied credit — a goodwill adjustment or a correction. */
    adjustmentAmount: numeric('adjustment_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    adjustmentReason: text('adjustment_reason'),

    /** Generated: the customer's total for the month. */
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).generatedAlwaysAs(
      sql`round(milk_amount + products_amount - adjustment_amount, 2)`,
    ),

    /** Recomputed from verified payments. Never incremented in place. */
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),

    status: billStatusEnum('status').notNull().default('OPEN'),
    dueDate: date('due_date').notNull(),

    /** Set by the month-close job. A frozen bill is no longer recomputed. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    // Denormalised counters for the invoice header — cheap to store, costly to recompute.
    deliveredDays: numeric('delivered_days', { precision: 6, scale: 0 }).notNull().default('0'),
    skippedDays: numeric('skipped_days', { precision: 6, scale: 0 }).notNull().default('0'),
    totalQuantity: numeric('total_quantity', { precision: 12, scale: 3 }).notNull().default('0'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** The constraint the old schema lacked, despite reading with `.maybeSingle()`. */
    oneBillPerCustomerMonth: uniqueIndex('bills_customer_month_key').on(t.customerId, t.month),
    milkmanIdx: index('bills_milkman_idx').on(t.milkmanId, t.month),
    statusIdx: index('bills_status_idx').on(t.status, t.dueDate),
    amountsNonNegative: check(
      'bills_amounts_non_negative',
      sql`${t.milkAmount} >= 0 and ${t.productsAmount} >= 0 and ${t.paidAmount} >= 0`,
    ),
  }),
);

/**
 * A customer's payment against one bill.
 *
 * Flow: the customer pays offline (UPI QR or cash) and records it here as
 * SUBMITTED with a reference; the milkman confirms receipt, moving it to
 * VERIFIED. Only VERIFIED rows count toward `monthlyBills.paidAmount`.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** NOT NULL by design — see the module note. */
    billId: uuid('bill_id')
      .notNull()
      .references(() => monthlyBills.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum('method').notNull().default('UPI'),
    /** UTR or transaction reference. A real column, not a repurposed gateway id. */
    reference: varchar('reference', { length: 120 }),
    /** The customer's own note. Not stored in a field called "failure reason". */
    customerNote: text('customer_note'),

    status: paymentStatusEnum('status').notNull().default('SUBMITTED'),

    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    billIdx: index('payments_bill_idx').on(t.billId, t.status),
    customerIdx: index('payments_customer_idx').on(t.customerId, t.createdAt),
    milkmanQueueIdx: index('payments_milkman_idx').on(t.milkmanId, t.status, t.createdAt),
    amountPositive: check('payments_amount_positive', sql`${t.amount} > 0`),
  }),
);
