import 'server-only';
import webpush from 'web-push';

import * as pushRepo from '@/repositories/push.repo.js';

/**
 * Web push to a person's devices.
 *
 * Sent with `web-push`, which signs the request with the VAPID keys *and*
 * encrypts the payload with each device's own keys (RFC 8291). The previous
 * version signed by hand and POSTed the JSON unencrypted; Google's push
 * service rejects that, and since only 404/410 were looked at, every push
 * failed without a trace.
 *
 * There are no fallback keys in the source. A private key in the repository is
 * a leaked key, and a fallback that differs from the one the browser
 * subscribed with fails silently anyway. Missing keys turn push off, loudly.
 */

const clean = (value) => (value ?? '').replace(/['"]/g, '').trim();

const PUBLIC_KEY = clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const PRIVATE_KEY = clean(process.env.VAPID_PRIVATE_KEY);
const SUBJECT = clean(process.env.VAPID_SUBJECT) || 'mailto:support@dairydrop.in';

let configured = false;
let warned = false;

function ready() {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    if (!warned) {
      console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — web push is off.');
      warned = true;
    }
    return false;
  }
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (error) {
    if (!warned) {
      console.error('[push] VAPID keys are invalid — web push is off:', error.message);
      warned = true;
    }
  }
  return configured;
}

/**
 * Send one notification to every device a user has subscribed.
 *
 * @param {string} userId
 * @param {{title: string, body?: string, href?: string, tag?: string, data?: object}} payload
 * @returns {Promise<{sent: number, failed: number, removed: number}>}
 */
export async function sendPushNotification(userId, payload) {
  const outcome = { sent: 0, failed: 0, removed: 0 };
  if (!userId || !ready()) return outcome;

  let subscriptions;
  try {
    subscriptions = await pushRepo.listSubscriptionsForUser(userId);
  } catch (error) {
    console.warn('[push] could not load subscriptions:', error?.message);
    return outcome;
  }
  if (!subscriptions?.length) return outcome;

  const body = JSON.stringify({
    title: payload.title || 'DairyDrop',
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    href: payload.href || '/',
    tag: payload.tag || 'dairydrop',
    timestamp: Date.now(),
    data: payload.data || {},
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 86_400, urgency: 'high' },
        );
        outcome.sent += 1;
      } catch (error) {
        // 404/410: the browser dropped this subscription — forget it.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await pushRepo.removeSubscription(sub.endpoint).catch(() => {});
          outcome.removed += 1;
          return;
        }
        outcome.failed += 1;
        console.warn(
          `[push] ${error?.statusCode ?? 'error'} from ${hostOf(sub.endpoint)}: ${error?.body || error?.message}`,
        );
      }
    }),
  );

  return outcome;
}

function hostOf(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'unknown host';
  }
}
