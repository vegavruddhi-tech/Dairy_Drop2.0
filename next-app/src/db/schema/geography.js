/**
 * Geography: where a milkman delivers, and where a customer lives.
 *
 * The previous system expressed coverage three different ways — a polymorphic
 * `service_areas` JSON blob, a `zones` table, and a `milkman_delivery_areas`
 * table — and serviceability fell through all three with bidirectional substring
 * matching. One normalised table replaces all of it, and matching is exact.
 */

import { sql } from 'drizzle-orm';
import {
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  numeric,
  integer,
} from 'drizzle-orm/pg-core';

import { pgTable } from './_schema.js';

import { users } from './identity.js';

/**
 * One row per (milkman, pincode) pair the milkman serves.
 * Serviceability is now a single indexed equality lookup.
 */
export const serviceAreas = pgTable(
  'service_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    milkmanId: uuid('milkman_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Human label shown in the signup picker, e.g. "Sector 45". */
    areaName: varchar('area_name', { length: 120 }).notNull(),
    pincode: varchar('pincode', { length: 10 }).notNull(),
    city: varchar('city', { length: 120 }).notNull(),
    state: varchar('state', { length: 120 }).notNull(),

    /** Order the round is walked in. Lower first. */
    routeSequence: integer('route_sequence').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // A milkman cannot list the same area twice.
    uniquePerMilkman: uniqueIndex('service_areas_milkman_area_key').on(
      t.milkmanId,
      t.areaName,
      t.pincode,
    ),
    // Drives "who delivers to 122001?" on the signup screen.
    pincodeIdx: index('service_areas_pincode_idx').on(t.pincode, t.isActive),
    milkmanIdx: index('service_areas_milkman_idx').on(t.milkmanId, t.isActive),
  }),
);

/**
 * A customer's delivery address.
 *
 * Four pairs of duplicate columns existed before (street/address_line1,
 * landmark/address_line2, pincode/postal_code, is_default/is_primary). One of
 * each survives.
 */
export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Optional recipient override — a relative receiving on the customer's behalf. */
    recipientName: varchar('recipient_name', { length: 160 }),
    recipientPhone: varchar('recipient_phone', { length: 20 }),

    line1: text('line1').notNull(),
    line2: text('line2'),
    area: varchar('area', { length: 120 }).notNull(),
    city: varchar('city', { length: 120 }).notNull(),
    state: varchar('state', { length: 120 }).notNull(),
    pincode: varchar('pincode', { length: 10 }).notNull(),
    landmark: varchar('landmark', { length: 200 }),

    /** Shown to the milkman on the round. "Ring the bell twice", "leave with guard". */
    deliveryInstructions: text('delivery_instructions'),

    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),

    isDefault: boolean('is_default').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('addresses_user_idx').on(t.userId),
    // At most one default per user, enforced by the database rather than by
    // remembering to clear the old one in application code.
    oneDefaultPerUser: uniqueIndex('addresses_one_default_per_user')
      .on(t.userId)
      .where(sql`is_default`),
  }),
);
