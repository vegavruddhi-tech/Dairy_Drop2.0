/**
 * Extra products: the milkman's side catalog (paneer, ghee, curd) and customer
 * orders against it.
 *
 * The old model had three overlapping order tables — `product_purchases`,
 * `daily_product_orders` and `additional_orders` — of which only the first was
 * ever written. One survives.
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
  check,
} from 'drizzle-orm/pg-core';

import { pgTable } from './_schema.js';
import { sql } from 'drizzle-orm';

import { users } from './identity.js';
import { purchaseStatusEnum } from './enums.js';

/** An item in a milkman's catalog. */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),

    unit: varchar('unit', { length: 16 }).notNull().default('kg'),
    pricePerUnit: numeric('price_per_unit', { precision: 12, scale: 2 }).notNull(),

    /**
     * Stock on hand. Decremented by an atomic conditional UPDATE, never by
     * read-then-write — see src/repositories/products.repo.js. The CHECK below
     * is the backstop that makes overselling impossible even under a race.
     */
    availableQuantity: numeric('available_quantity', { precision: 10, scale: 3 })
      .notNull()
      .default('0'),

    isActive: boolean('is_active').notNull().default(true),
    availableFrom: date('available_from').notNull().defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milkmanIdx: index('products_milkman_idx').on(t.milkmanId, t.isActive),
    stockNonNegative: check('products_stock_non_negative', sql`${t.availableQuantity} >= 0`),
    pricePositive: check('products_price_positive', sql`${t.pricePerUnit} > 0`),
  }),
);

/** A customer's order for a catalog item. Billed on top of milk. */
export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Snapshot — the catalog may change or the product may be deleted later.
    productName: varchar('product_name', { length: 120 }).notNull(),
    unit: varchar('unit', { length: 16 }).notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),

    /** Generated, so it can never disagree with quantity × price. */
    amount: numeric('amount', { precision: 12, scale: 2 }).generatedAlwaysAs(
      sql`round(quantity * unit_price, 2)`,
    ),

    /** Flattened address at order time, so later edits don't rewrite history. */
    deliveryAddress: text('delivery_address'),

    /** Business date the order belongs to — drives which month it bills in. */
    orderDate: date('order_date').notNull(),

    status: purchaseStatusEnum('status').notNull().default('PENDING'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('purchases_customer_idx').on(t.customerId, t.orderDate),
    milkmanIdx: index('purchases_milkman_idx').on(t.milkmanId, t.status, t.orderDate),
    /**
     * Billing reads exactly this. Cancelled orders are excluded here rather
     * than being filtered (or forgotten) at every call site.
     */
    billableIdx: index('purchases_billable_idx')
      .on(t.customerId, t.orderDate)
      .where(sql`status <> 'CANCELLED'`),
    quantityPositive: check('purchases_qty_positive', sql`${t.quantity} > 0`),
  }),
);
