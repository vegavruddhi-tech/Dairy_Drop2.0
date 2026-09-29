import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { pushSubscriptions } from '@/db/schema/index.js';

/** Upsert or register a push subscription for a user */
export async function saveSubscription(userId, { endpoint, p256dh, auth, userAgent }) {
  if (!userId || !endpoint || !p256dh || !auth) return null;

  // Check if subscription exists
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(pushSubscriptions)
      .set({
        userId,
        p256dh,
        auth,
        userAgent: userAgent ?? existing[0].userAgent,
        updatedAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent ?? null,
    })
    .returning();

  return inserted;
}

/** List all push endpoints for a user */
export async function listSubscriptionsForUser(userId) {
  if (!userId) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/**
 * Forget an endpoint the push service says is dead (404/410). System use only:
 * the push service, not a user, is the authority here.
 */
export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  return db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * A user unsubscribing one of their own devices. Matching on the endpoint
 * alone let anyone who learned an endpoint switch off someone else's alerts.
 */
export async function removeOwnSubscription(userId, endpoint) {
  if (!userId || !endpoint) return;
  return db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

/** Remove all subscriptions for a user */
export async function removeSubscriptionsForUser(userId) {
  if (!userId) return;
  return db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}
