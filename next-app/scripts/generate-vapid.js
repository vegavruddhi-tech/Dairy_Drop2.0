/**
 * Generates VAPID Public and Private Keys for Web Push Notifications.
 * Run with: node scripts/generate-vapid.js
 */

import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});

// For VAPID public key, standard is raw 65-byte uncompressed point
const rawPublicKey = publicKey.subarray(publicKey.length - 65);

function base64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const vapidPublicKey = base64Url(rawPublicKey);
const vapidPrivateKey = privateKey.toString('base64');

console.log('=== VAPID KEYS FOR DAIRYDROP ===\n');
console.log('Copy these into your .env and Vercel Environment Variables:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidPublicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidPrivateKey}"`);
console.log(`VAPID_SUBJECT="mailto:support@dairydrop.in"\n`);
