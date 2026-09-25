import 'server-only';
import crypto from 'node:crypto';
import * as pushRepo from '@/repositories/push.repo.js';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@dairydrop.in';

/**
 * URL-safe Base64 encoding helper
 */
function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate VAPID Authorization Header for an audience endpoint (RFC 8292)
 */
function generateVapidAuthHeader(audience, publicKey, privateKey, subject) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: subject,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;

  // Sign with ECDSA P-256 private key
  try {
    const keyObject = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });

    const sign = crypto.createSign('SHA256');
    sign.update(unsignedToken);
    sign.end();

    const signature = sign.sign({ key: keyObject, dsaEncoding: 'ieee-p1363' });
    const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

    return {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
    };
  } catch {
    // If keys are provided in raw uncompressed format
    return null;
  }
}

/**
 * Send a web push notification to all active devices of a user.
 *
 * @param {string} userId
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} [payload.href]
 * @param {string} [payload.tag]
 * @param {Object} [payload.data]
 */
export async function sendPushNotification(userId, payload) {
  if (!userId) return;

  const subscriptions = await pushRepo.listSubscriptionsForUser(userId);
  if (!subscriptions || subscriptions.length === 0) return;

  const pushPayload = JSON.stringify({
    title: payload.title || 'DairyDrop',
    body: payload.body || '',
    icon: '/image.png',
    badge: '/image.png',
    href: payload.href || '/',
    tag: payload.tag || 'dairydrop-alert',
    timestamp: Date.now(),
    data: payload.data || {},
  });

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      const endpointUrl = new URL(sub.endpoint);
      const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

      const headers = {
        'Content-Type': 'application/json',
        TTL: '86400', // 24 hours
        Urgency: 'high',
      };

      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const vapidHeader = generateVapidAuthHeader(
          audience,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY,
          VAPID_SUBJECT,
        );
        if (vapidHeader) {
          Object.assign(headers, vapidHeader);
        }
      }

      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers,
        body: pushPayload,
      });

      // 410 Gone or 404 means the user revoked permission or unregistered device
      if (res.status === 410 || res.status === 404) {
        await pushRepo.removeSubscription(sub.endpoint);
      }
    } catch (err) {
      console.warn(`[push] Failed delivery to endpoint: ${sub.endpoint.slice(0, 30)}...`, err?.message);
    }
  });

  await Promise.allSettled(sendPromises);
}

/**
 * Helper to dispatch both in-app notification and web push simultaneously.
 */
export async function notifyUser(userId, { type, title, body, href, subjectType, subjectId, metadata }) {
  // 1. Send push to physical devices
  await sendPushNotification(userId, { title, body, href, tag: type, data: { subjectType, subjectId, ...metadata } });
}
