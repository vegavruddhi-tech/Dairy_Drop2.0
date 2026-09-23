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
  time,
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

    /*
     * When the round actually reaches the door, per slot.
     *
     * A window rather than an instant: one milkman covers a whole area from one
     * bike, so "06:00" would be a promise broken at every door but the first.
     * Nullable, because plans created before this existed have no window and a
     * blank is more honest than a default invented on their behalf.
     *
     * Stored as local wall-clock `time`, not `timestamptz` — "6 am" means 6 am
     * in APP_TIMEZONE every day, and does not shift with the date.
     */
    morningStart: time('morning_start'),
    morningEnd: time('morning_end'),
    eveningStart: time('evening_start'),
    eveningEnd: time('evening_end'),

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
    // Both ends together, and the end after the start. A half-filled window
    // cannot be rendered and an inverted one cannot be met.
    coherentWindows: check(
      'milk_plans_windows_coherent',
      sql`(${t.morningStart} is null) = (${t.morningEnd} is null)
      and (${t.eveningStart} is null) = (${t.eveningEnd} is null)
      and (${t.morningStart} is null or ${t.morningEnd} > ${t.morningStart})
      and (${t.eveningStart} is null or ${t.eveningEnd} > ${t.eveningStart})`,
    ),
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

    /*
     * Which times this subscription fills, derived from the slot.
     *
     * `BOTH` fills two, so it cannot be compared as a single value — a customer
     * on a morning plan and a morning-and-evening plan collides on morning, and
     * no unique index over `slot` alone can see that. Exploding it into two
     * booleans makes the collision something the database can enforce, via the
     * partial unique indexes below.
     *
     * Generated, so they cannot drift from `slot`.
     */
    occupiesMorning: boolean('occupies_morning').generatedAlwaysAs(
      sql`slot in ('MORNING', 'BOTH')`,
    ),
    occupiesEvening: boolean('occupies_evening').generatedAlwaysAs(
      sql`slot in ('EVENING', 'BOTH')`,
    ),

    /*
     * What makes two orders the same thing.
     *
     * `product_name` is free text, so "Cow Milk" and "cow milk " are one
     * product spelled three ways. Normalising here rather than at each call
     * site means the index and `productKey()` in the domain agree by
     * construction. A product catalog referenced by id would be better, and
     * would retire this column.
     */
    productKey: varchar('product_key', { length: 120 }).generatedAlwaysAs(
      sql`lower(btrim(product_name))`,
    ),

    /*
     * Snapshotted with everything else the customer agreed to. Editing the plan
     * later must not silently move the time an existing customer was promised.
     */
    morningStart: time('morning_start'),
    morningEnd: time('morning_end'),
    eveningStart: time('evening_start'),
    eveningEnd: time('evening_end'),

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
    /*
     * One order per product, per time of day, per customer.
     *
     * Keyed on the product as well as the time, because a stop is one *visit*,
     * not one item — a milkman arriving at 6am can hand over cow milk and
     * buffalo milk together. What cannot happen is the same product twice at
     * the same time; that is one order written down twice.
     *
     * The service refuses the collision with a message naming the plan in the
     * way, but a Server Action is a public endpoint and two simultaneous
     * requests can both pass a service check; only the index can refuse both.
     *
     * A PAUSED subscription keeps its slot: it is coming back, and releasing
     * the slot would let something else take it with no way to resume. A
     * cancelled or superseded version has `effective_to` set and holds nothing.
     */
    oneMorningPerProduct: uniqueIndex('milk_subs_one_morning_per_product')
      .on(t.customerId, t.productKey)
      .where(sql`occupies_morning and effective_to is null and status in ('ACTIVE', 'PAUSED')`),
    oneEveningPerProduct: uniqueIndex('milk_subs_one_evening_per_product')
      .on(t.customerId, t.productKey)
      .where(sql`occupies_evening and effective_to is null and status in ('ACTIVE', 'PAUSED')`),

    positiveQuantity: check('milk_subs_qty_positive', sql`${t.quantity} > 0`),
    nonNegativePrice: check('milk_subs_price_non_negative', sql`${t.unitPrice} >= 0`),
    sensibleRange: check(
      'milk_subs_range',
      sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`,
    ),
  }),
);
