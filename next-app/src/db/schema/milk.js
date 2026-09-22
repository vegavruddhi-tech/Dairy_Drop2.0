/**
 * The operational layer: what a milkman sells to their customers.
 *
 * The important change from the old model is that subscriptions are now
 * **versioned**. Approving a plan change used to rewrite the subscription row in
 * place, destroying history — a bill spanning the change date silently used the
 * new price for the whole month. Here a change closes the current row and opens
 * a successor, so billing can walk the rows that overlap a month and charge each
 * at the price that was actually in force.
 */

import {
  uuid,
  text,
  varchar,
  boolean,
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
import {
  frequencyEnum,
  deliverySlotEnum,
  milkSubscriptionStatusEnum,
} from './enums.js';

/** A milk package a milkman offers. The catalog, not an enrolment. */
export const milkPlans = pgTable(
  'milk_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    productName: varchar('product_name', { length: 120 }).notNull(),

    /** Litres (or `unit`s) per delivery. */
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
    unit: varchar('unit', { length: 16 }).notNull().default('L'),

    frequency: frequencyEnum('frequency').notNull().default('DAILY'),
    slot: deliverySlotEnum('slot').notNull().default('MORNING'),

    /**
     * Exactly one pricing basis must be set, enforced by a CHECK below.
     * The old model allowed both and silently preferred `price_per_delivery`,
     * which made "why is my bill different" impossible to answer.
     */
    pricePerDelivery: numeric('price_per_delivery', { precision: 12, scale: 2 }),
    monthlyPrice: numeric('monthly_price', { precision: 12, scale: 2 }),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanIdx: index('milk_plans_milkman_idx').on(t.milkmanId, t.isActive),
    exactlyOnePrice: check(
      'milk_plans_one_price',
      sql`(${t.pricePerDelivery} is not null and ${t.monthlyPrice} is null)
       or (${t.pricePerDelivery} is null and ${t.monthlyPrice} is not null)`,
    ),
    positiveQuantity: check('milk_plans_qty_positive', sql`${t.quantity} > 0`),
  }),
);

/**
 * A customer's enrolment in a plan — one **version** of it.
 *
 * Invariants:
 *   · `effectiveTo IS NULL` means this is the current version.
 *   · Versions of the same logical subscription share `rootId`.
 *   · Ranges never overlap within a `rootId`.
 *
 * Price and quantity are snapshotted here, so later edits to `milkPlans` never
 * rewrite what a customer already agreed to.
 */
export const milkSubscriptions = pgTable(
  'milk_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Stable identity across versions. The first version sets this to its own
     * id; every successor copies it. Deliveries reference `rootId`, so a plan
     * change never orphans delivery history.
     */
    rootId: uuid('root_id').notNull(),
    /** The version this one replaced, for a readable audit trail. */
    supersedesId: uuid('supersedes_id'),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').references(() => milkPlans.id, { onDelete: 'set null' }),

    // ── Snapshot of the agreed terms ─────────────────────────────────────────
    productName: varchar('product_name', { length: 120 }).notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
    unit: varchar('unit', { length: 16 }).notNull().default('L'),
    frequency: frequencyEnum('frequency').notNull().default('DAILY'),
    slot: deliverySlotEnum('slot').notNull().default('MORNING'),

    /**
     * The rate, resolved once at enrolment and frozen.
     *
     * `unitPrice` is ₹ per unit per delivery. Every delivery generated from this
     * subscription copies it onto the delivery row, so a delivery is a complete,
     * immutable financial record. The old system left `price_per_unit` null
     * forever and fell back to a hardcoded ₹75.
     */
    unitPrice: numeric('unit_price', { precision: 12, scale: 4 }).notNull(),
    /** Informational: what the customer was quoted per month. */
    quotedMonthlyPrice: numeric('quoted_monthly_price', { precision: 12, scale: 2 }),

    status: milkSubscriptionStatusEnum('status').notNull().default('ACTIVE'),

    // ── Version validity ─────────────────────────────────────────────────────
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),

    pausedAt: timestamp('paused_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('milk_subs_customer_idx').on(t.customerId, t.status),
    milkmanIdx: index('milk_subs_milkman_idx').on(t.milkmanId, t.status),
    rootIdx: index('milk_subs_root_idx').on(t.rootId, t.effectiveFrom),
    /** Only one open version per logical subscription. */
    oneCurrentPerRoot: uniqueIndex('milk_subs_one_current_per_root')
      .on(t.rootId)
      .where(sql`effective_to is null`),
    /** Drives the nightly delivery generator. */
    activeIdx: index('milk_subs_active_idx')
      .on(t.status, t.effectiveFrom)
      .where(sql`status = 'ACTIVE'`),
    positiveQuantity: check('milk_subs_qty_positive', sql`${t.quantity} > 0`),
    nonNegativePrice: check('milk_subs_price_non_negative', sql`${t.unitPrice} >= 0`),
    sensibleRange: check(
      'milk_subs_range',
      sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
    ),
  }),
);
