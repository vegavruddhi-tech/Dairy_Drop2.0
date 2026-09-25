'use server';

import { requireActor } from '@/auth/session.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';

/** Fetch current user's inbox notifications and unread count */
export async function getInboxNotifications() {
  const actor = await requireActor();
  const [items, unreadCount] = await Promise.all([
    notificationsRepo.listInbox(actor, { limit: 20 }),
    notificationsRepo.countUnread(actor),
  ]);

  return {
    ok: true,
    items: items || [],
    unreadCount: unreadCount || 0,
  };
}

/** Mark all or specific notifications as read */
export async function markNotificationsAsRead(ids) {
  const actor = await requireActor();
  await notificationsRepo.markRead(actor, ids);
  return { ok: true };
}
