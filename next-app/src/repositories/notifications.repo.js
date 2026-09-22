/**
 * Notification data access.
 */

import 'server-only';
import { and, eq, desc, isNull, lt, sql, inArray } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { notifications } from '@/db/schema/index.js';
import { paginate } from './base.js';

/** Insert one or many. Always scoped to a recipient by construction. */
export async function create(tx, values) {
  const rows = Array.isArray(values) ? values : [values];
  if (rows.length === 0) return [];
  return tx.insert(notifications).values(rows).returning({ id: notifications.id });
}

/**
 * The actor's inbox.
 *
 * Always filtered to `userId = actor.userId` — a notification is addressed to
 * exactly one person, so there is no scope to resolve.
 */
export async function listInbox(actor, page = {}) {
  const { limit, offset } = paginate(page, 100);
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.archivedAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countUnread(actor) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, actor.userId),
        isNull(notifications.readAt),
        isNull(notifications.archivedAt),
      ),
    );
  return row?.count ?? 0;
}

export async function markRead(actor, ids) {
  const filter = ids?.length
    ? and(eq(notifications.userId, actor.userId), inArray(notifications.id, ids))
    : and(eq(notifications.userId, actor.userId), isNull(notifications.readAt));

  return db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(filter)
    .returning({ id: notifications.id });
}

/**
 * Soft-delete old notifications.
 *
 * The previous system hard-DELETEd anything older than 30 hours, on every read.
 * Losing a payment-confirmation notice after a day and a half is a support
 * ticket; archiving after 90 keeps the history without growing unbounded.
 */
export async function archiveOlderThan(cutoff) {
  return db
    .update(notifications)
    .set({ archivedAt: new Date() })
    .where(and(lt(notifications.createdAt, cutoff), isNull(notifications.archivedAt)))
    .returning({ id: notifications.id });
}
