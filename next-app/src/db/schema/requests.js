/**
 * Customer-initiated requests that need a milkman decision.
 *
 * Two kinds, and the distinction matters:
 *   · A quantity change affects exactly one delivery on one date.
 *   · A plan change permanently replaces the subscription.
 *
 * The old system blurred them — approving a one-day quantity request rewrote
 * the subscription's standard quantity forever, across every plan the customer
 * held. Here a quantity request can only ever write `deliveries.adjustedQuantity`
 * for its own date, and it names the exact delivery it targets.
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
import { milkPlans } from './milk.js';
import { deliveries } from './deliveries.js';
import { requestStatusEnum, deliverySlotEnum } from './enums.js';

/** "Please bring 2 L instead of 1 L on Thursday." One day only. */
export const quantityChangeRequests = pgTable(
  'quantity_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The exact delivery being changed. No ambiguity for multi-plan customers. */
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    deliveryDate: date('delivery_date').notNull(),

    currentQuantity: numeric('current_quantity', { precision: 10, scale: 3 }).notNull(),
    requestedQuantity: numeric('requested_quantity', { precision: 10, scale: 3 }).notNull(),

    status: requestStatusEnum('status').notNull().default('PENDING'),
    customerNote: text('customer_note'),
    milkmanNote: text('milkman_note'),

    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanQueueIdx: index('qcr_milkman_idx').on(t.milkmanId, t.status, t.deliveryDate),
    customerIdx: index('qcr_customer_idx').on(t.customerId, t.createdAt),
    /** One open request per delivery. */
    onePendingPerDelivery: uniqueIndex('qcr_one_pending_per_delivery')
      .on(t.deliveryId)
      .where(sql`status = 'PENDING'`),
    requestedPositive: check('qcr_requested_positive', sql`${t.requestedQuantity} > 0`),
  }),
);

/** "Please move me from the 1 L plan to the 2 L plan." Permanent. */
export const planChangeRequests = pgTable(
  'plan_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The logical subscription to be changed. */
    subscriptionRootId: uuid('subscription_root_id').notNull(),
    requestedPlanId: uuid('requested_plan_id')
      .notNull()
      .references(() => milkPlans.id, { onDelete: 'cascade' }),

    // Both sides snapshotted, so the milkman sees a true before/after even if a
    // plan is edited between request and decision.
    currentPlanName: varchar('current_plan_name', { length: 120 }).notNull(),
    currentQuantity: numeric('current_quantity', { precision: 10, scale: 3 }).notNull(),
    currentUnit: varchar('current_unit', { length: 16 }).notNull(),
    currentMonthlyPrice: numeric('current_monthly_price', { precision: 12, scale: 2 }),

    requestedPlanName: varchar('requested_plan_name', { length: 120 }).notNull(),
    requestedQuantity: numeric('requested_quantity', { precision: 10, scale: 3 }).notNull(),
    requestedUnit: varchar('requested_unit', { length: 16 }).notNull(),
    requestedMonthlyPrice: numeric('requested_monthly_price', { precision: 12, scale: 2 }),
    requestedSlot: deliverySlotEnum('requested_slot'),

    status: requestStatusEnum('status').notNull().default('PENDING'),
    /** Required — the old system rejected empty reasons and that was right. */
    customerNote: text('customer_note').notNull(),
    milkmanNote: text('milkman_note'),

    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanQueueIdx: index('pcr_milkman_idx').on(t.milkmanId, t.status, t.createdAt),
    customerIdx: index('pcr_customer_idx').on(t.customerId, t.createdAt),
    /**
     * One open request per subscription — not per customer. The old partial
     * index keyed on customer, which silently blocked multi-plan customers from
     * changing a second plan.
     */
    onePendingPerSubscription: uniqueIndex('pcr_one_pending_per_subscription')
      .on(t.subscriptionRootId)
      .where(sql`status = 'PENDING'`),
    requestedPositive: check('pcr_requested_positive', sql`${t.requestedQuantity} > 0`),
  }),
);
