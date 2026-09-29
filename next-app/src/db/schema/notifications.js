/**
 * In-app notifications.
 *
 * One table for all three roles — the old schema had a second
 * `milkman_notifications` table that was only ever purged, never written or read.
 *
 * Retention is soft-delete with a long window, not the old 30-hour hard DELETE
 * that fired on every read. Losing a payment-confirmation notice after 30 hours
 * is a support ticket waiting to happen.
 */

import {
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

import { pgTable } from './_schema.js';
import { sql } from 'drizzle-orm';

import { users } from './identity.js';
import { notificationTypeEnum } from './enums.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),

    /** Where tapping it should go, e.g. '/milkman/requests'. */
    href: varchar('href', { length: 300 }),
    /** The row this is about, for deep links and de-duplication. */
    subjectType: varchar('subject_type', { length: 60 }),
    subjectId: uuid('subject_id'),
    metadata: jsonb('metadata').$type().default({}),

    readAt: timestamp('read_at', { withTimezone: true }),
    /** Soft delete. The purge job sets this; nothing hard-deletes. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** The bell: unread, newest first, not archived. */
    inboxIdx: index('notifications_inbox_idx')
      .on(t.userId, t.createdAt)
      .where(sql`archived_at is null`),
    unreadIdx: index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`read_at is null and archived_at is null`),
    subjectIdx: index('notifications_subject_idx').on(t.subjectType, t.subjectId),
  }),
);

/**
 * Web-push subscriptions: one row per browser/device endpoint.
 *
 * Matches the table as it exists (created by 0006_push_subscriptions.sql):
 * `user_id` is text with no foreign key, and `endpoint` is unique. A second,
 * unused definition in `schema/push.js` disagreed with this one and is gone.
 * Rows for a deleted user are never reached (pushes are looked up by user id)
 * and 404/410 from the push service removes dead ones.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('push_subscriptions_user_id_idx').on(t.userId),
  }),
);
