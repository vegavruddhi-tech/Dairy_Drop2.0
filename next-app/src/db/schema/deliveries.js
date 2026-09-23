/**
 * Deliveries — the billing atom.
 *
 * One row per subscription per day. Everything the customer owes and everything
 * the milkman earned reconciles from this table, so each row is a complete,
 * self-contained financial record: it carries its own price, its own quantity
 * and its own computed amount. Nothing needs to be re-derived from the plan
 * later, and a later plan edit can never rewrite delivered history.
 *
 * Two constraints here remove whole classes of bug the old system had:
 *   · UNIQUE (subscription_root_id, delivery_date) makes generation idempotent
 *     and makes double-billing structurally impossible.
 *   · amount is a generated column, so it can never drift from qty × price.
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
import { milkSubscriptions } from './milk.js';
import { deliveryStatusEnum, deliverySlotEnum, skipReasonEnum } from './enums.js';

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Points at the subscription's stable `rootId`, not at a version id — a plan
     * change must never orphan delivery history.
     */
    subscriptionRootId: uuid('subscription_root_id').notNull(),
    /** The exact version in force on this date, for auditing a disputed bill. */
    subscriptionVersionId: uuid('subscription_version_id').references(
      () => milkSubscriptions.id,
      { onDelete: 'set null' },
    ),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Business date in APP_TIMEZONE, never UTC. */
    deliveryDate: date('delivery_date').notNull(),
    slot: deliverySlotEnum('slot').notNull().default('MORNING'),

    // ── Snapshot of what was owed ────────────────────────────────────────────
    productName: varchar('product_name', { length: 120 }).notNull(),
    unit: varchar('unit', { length: 16 }).notNull().default('L'),

    /** What the subscription says should arrive. */
    plannedQuantity: numeric('planned_quantity', { precision: 10, scale: 3 }).notNull(),
    /**
     * What the customer asked for on this specific date — a one-day adjustment.
     * Null means "no adjustment". A one-day change writes here and *nowhere else*;
     * it must never touch the subscription.
     */
    adjustedQuantity: numeric('adjusted_quantity', { precision: 10, scale: 3 }),
    /** What was actually handed over. Set only when DELIVERED. */
    deliveredQuantity: numeric('delivered_quantity', { precision: 10, scale: 3 }),

    /** ₹ per unit, copied from the subscription version at generation time. Frozen. */
    unitPrice: numeric('unit_price', { precision: 12, scale: 4 }).notNull(),

    /**
     * Money owed for this delivery. A generated column — the database computes
     * it, so it cannot disagree with quantity × price. Non-delivered statuses
     * bill zero.
     */
    amount: numeric('amount', { precision: 12, scale: 2 }).generatedAlwaysAs(
      sql`case when status = 'DELIVERED'
               then round(coalesce(delivered_quantity, 0) * unit_price, 2)
               else 0 end`,
    ),

    status: deliveryStatusEnum('status').notNull().default('PENDING'),
    skipReason: skipReasonEnum('skip_reason'),
    note: text('note'),

    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** Who marked it — the milkman, or the system on a bulk day off. */
    markedBy: uuid('marked_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /**
     * The constraint the old schema was missing. Generation can run twice, or be
     * backfilled, without ever creating a second billable row for a day.
     *
     * Keyed on the **slot** as well, because "morning & evening" is genuinely
     * two drops: a morning round and an evening round, each carrying the plan's
     * quantity. Without the slot in the key those two collide, which is why the
     * generator only ever produced one of them and a customer on two deliveries
     * a day was billed for one.
     */
    oneRowPerSubscriptionSlot: uniqueIndex('deliveries_subscription_date_slot_key').on(
      t.subscriptionRootId,
      t.deliveryDate,
      t.slot,
    ),

    // The milkman's round for a given day.
    roundIdx: index('deliveries_round_idx').on(t.milkmanId, t.deliveryDate, t.status),
    // The customer's month, for billing and history.
    customerMonthIdx: index('deliveries_customer_date_idx').on(t.customerId, t.deliveryDate),
    // Month-close and earnings aggregates.
    billingIdx: index('deliveries_billing_idx')
      .on(t.customerId, t.deliveryDate, t.status)
      .where(sql`status = 'DELIVERED'`),

    quantitiesNonNegative: check(
      'deliveries_quantities_non_negative',
      sql`${t.plannedQuantity} >= 0
      and (${t.adjustedQuantity} is null or ${t.adjustedQuantity} >= 0)
      and (${t.deliveredQuantity} is null or ${t.deliveredQuantity} >= 0)`,
    ),
    /** A sanity ceiling — no household takes 100 L in one drop. */
    quantityCeiling: check(
      'deliveries_quantity_ceiling',
      sql`${t.plannedQuantity} <= 100
      and (${t.adjustedQuantity} is null or ${t.adjustedQuantity} <= 100)
      and (${t.deliveredQuantity} is null or ${t.deliveredQuantity} <= 100)`,
    ),
    /** DELIVERED must record what was delivered and when; nothing else may. */
    deliveredConsistency: check(
      'deliveries_delivered_consistency',
      sql`(${t.status} = 'DELIVERED'
           and ${t.deliveredQuantity} is not null
           and ${t.deliveredAt} is not null)
       or (${t.status} <> 'DELIVERED' and ${t.deliveredQuantity} is null)`,
    ),
  }),
);
