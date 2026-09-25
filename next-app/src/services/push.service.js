import 'server-only';
import crypto from 'node:crypto';
import * as pushRepo from '@/repositories/push.repo.js';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZfIjSPOQVZVt0Tzx5426Q1HTINWzz6F_joBp-0';
const DEFAULT_VAPID_PRIVATE_KEY =
  'UUxI1xsmOHOU3yTQngmg2PdLKoGXZGFZXb_Z_oY8j5I';

const VAPID_PUBLIC_KEY =
  (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').replace(/['"]/g, '').trim() || DEFAULT_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY =
  (process.env.VAPID_PRIVATE_KEY || '').replace(/['"]/g, '').trim() || DEFAULT_VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
  (process.env.VAPID_SUBJECT || '').replace(/['"]/g, '').trim() || 'mailto:support@dairydrop.in';

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
 * Parse base64url public and private keys into a crypto KeyObject
 */
function getPrivateKeyObject(pubKeyB64Url, privKeyB64Url) {
  try {
    // 1. Try JWK import
    const pubBuf = Buffer.from(pubKeyB64Url.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (pubBuf.length === 65 && pubBuf[0] === 0x04) {
      const x = base64UrlEncode(pubBuf.subarray(1, 33));
      const y = base64UrlEncode(pubBuf.subarray(33, 65));
      const d = privKeyB64Url.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      return crypto.createPrivateKey({
        key: { kty: 'EC', crv: 'P-256', d, x, y },
        format: 'jwk',
      });
    }
  } catch {
    // Fallback to DER if already in PKCS#8
  }

  try {
    return crypto.createPrivateKey({
      key: Buffer.from(privKeyB64Url, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    return null;
  }
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

  try {
    const keyObject = getPrivateKeyObject(publicKey, privateKey);
    if (!keyObject) return null;

    const sign = crypto.createSign('SHA256');
    sign.update(unsignedToken);
    sign.end();

    const signature = sign.sign({ key: keyObject, dsaEncoding: 'ieee-p1363' });
    const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

    return {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
    };
  } catch {
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

  let subscriptions;
  try {
    subscriptions = await pushRepo.listSubscriptionsForUser(userId);
  } catch (err) {
    console.warn('[push] Could not load subscriptions (table may be missing):', err?.message);
    return;
  }
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
