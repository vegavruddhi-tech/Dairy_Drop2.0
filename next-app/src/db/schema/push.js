/**
 * Web-push subscriptions.
 *
 * One row per browser/device endpoint. A user can have multiple rows — one per
 * device they have ever subscribed on. Rows are removed when the push service
 * returns 410 Gone (revoked by the browser) or on explicit user unsubscribe.
 */

import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pgTable } from './_schema.js';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** Clerk user ID — who receives the push. */
  userId: text('user_id').notNull(),

  /**
   * The push endpoint URL returned by the browser's PushManager.
   * Unique per device/browser profile; used as the stable key for upserts.
   */
  endpoint: text('endpoint').notNull().unique(),

  /** ECDH public key from the PushSubscription (base64url). */
  p256dh: text('p256dh').notNull(),

  /** HMAC authentication secret (base64url). */
  auth: text('auth').notNull(),

  /** Optional User-Agent string for debugging stale endpoints. */
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
