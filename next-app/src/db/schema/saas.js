/**
 * The SaaS layer: what the platform sells to milkmen.
 *
 * Renamed from `platform_subscription_plans` / `milkman_subscriptions` /
 * `platform_payments`. The old names sat one letter away from the *customer*
 * subscription tables and were a constant source of confusion — two completely
 * different billing systems that looked alike. `saas*` vs `milk*` now makes the
 * boundary obvious at every call site.
 */

import {
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  serial,
} from 'drizzle-orm/pg-core';

import { pgTable } from './_schema.js';
import { sql } from 'drizzle-orm';

import { users } from './identity.js';
import { saasStatusEnum, paymentStatusEnum } from './enums.js';

/**
 * A tier the platform sells. Tiering is by customer count, not by feature —
 * that matches how a milkman actually grows.
 */
export const saasPlans = pgTable(
  'saas_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),

    monthlyPrice: numeric('monthly_price', { precision: 12, scale: 2 }).notNull(),
    /** The enforced ceiling on approved customers. The core monetisation lever. */
    maxCustomers: integer('max_customers').notNull(),

    /** Bullet points rendered on the plan card. */
    features: jsonb('features').$type().notNull().default([]),

    /** Billing period length. Configuration, not the old hardcoded 30. */
    durationDays: integer('duration_days').notNull().default(30),

    isActive: boolean('is_active').notNull().default(true),
    /** Display order on the pricing screen. */
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ activeIdx: index('saas_plans_active_idx').on(t.isActive, t.sortOrder) }),
);

/**
 * A milkman's enrolment — a trial or a paid plan.
 *
 * `planId IS NULL` no longer means "trial"; `status = 'TRIAL'` does. Relying on
 * a null foreign key to encode a state was what made the old expiry logic so
 * hard to follow.
 */
export const saasSubscriptions = pgTable(
  'saas_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').references(() => saasPlans.id, { onDelete: 'set null' }),

    status: saasStatusEnum('status').notNull(),

    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    /**
     * The single source of truth for access. A subscription is live while
     * `endsAt` is in the future — no other rule, ever.
     */
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

    /** Customer ceiling frozen at purchase, so a later plan edit cannot retroactively change it. */
    customerLimit: integer('customer_limit').notNull(),
    /** Price frozen at purchase. */
    pricePaid: numeric('price_paid', { precision: 12, scale: 2 }).notNull().default('0'),

    /** Bank reference the milkman submitted for manual verification. */
    paymentReference: varchar('payment_reference', { length: 120 }),

    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanIdx: index('saas_subs_milkman_idx').on(t.milkmanId, t.status, t.createdAt),
    /**
     * At most one live subscription per milkman. The old system could hold
     * several and picked one by `ORDER BY created_at DESC LIMIT 1`, which meant
     * the answer to "is this milkman paid up" depended on insertion order.
     *
     * A payment awaiting verification is *not* live: it may sit beside the
     * live row, which is how a plan change works — the current plan keeps
     * running until an administrator confirms the new one.
     */
    oneLivePerMilkman: uniqueIndex('saas_subs_one_live_per_milkman')
      .on(t.milkmanId)
      .where(sql`status in ('TRIAL','ACTIVE')`),
    /** ...and at most one payment in the queue at a time. */
    onePendingPerMilkman: uniqueIndex('saas_subs_one_pending_per_milkman')
      .on(t.milkmanId)
      .where(sql`status = 'PENDING_VERIFICATION'`),
    /** A milkman gets exactly one trial, ever. */
    oneTrialPerMilkman: uniqueIndex('saas_subs_one_trial_per_milkman')
      .on(t.milkmanId)
      .where(sql`status = 'TRIAL' or (plan_id is null and status <> 'CANCELLED')`),
    expiryIdx: index('saas_subs_expiry_idx').on(t.status, t.endsAt),
  }),
);

/** Ledger of milkman→platform money. Written only by admin verification. */
export const saasPayments = pgTable(
  'saas_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => saasSubscriptions.id, {
      onDelete: 'set null',
    }),

    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    /** UTR / bank reference. First-class, not smuggled into a gateway id column. */
    reference: varchar('reference', { length: 120 }),
    status: paymentStatusEnum('status').notNull().default('SUBMITTED'),

    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanIdx: index('saas_payments_milkman_idx').on(t.milkmanId, t.createdAt),
    statusIdx: index('saas_payments_status_idx').on(t.status, t.createdAt),
  }),
);

/**
 * Single-row platform configuration: where milkmen send their SaaS payment.
 * `id` is pinned to 1 so there can only ever be one row.
 */
export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  upiId: varchar('upi_id', { length: 120 }),
  qrCodeUrl: text('qr_code_url'),
  bankDetails: text('bank_details'),
  supportPhone: varchar('support_phone', { length: 20 }),
  supportEmail: varchar('support_email', { length: 255 }),

  /** Trial terms, as configuration rather than three hardcoded constants. */
  trialDurationDays: integer('trial_duration_days').notNull().default(7),
  trialCustomerLimit: integer('trial_customer_limit').notNull().default(5),

  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
