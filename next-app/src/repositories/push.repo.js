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

/** Delete a single endpoint (e.g. on 410 Gone / 404 Unregistered or user unsubscribe) */
export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  return db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Remove all subscriptions for a user */
export async function removeSubscriptionsForUser(userId) {
  if (!userId) return;
  return db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}
