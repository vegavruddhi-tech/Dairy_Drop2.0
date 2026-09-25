/**
 * Generates VAPID Public and Private Keys for Web Push Notifications.
 * Run with: node scripts/generate-vapid.js
 *
 * Both keys are in the raw base64url format that web-push and this app's
 * push.service.js expect. The private key is the raw 32-byte EC scalar
 * (not PKCS8 DER), and the public key is the raw 65-byte uncompressed point.
 */

import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding:  { type: 'spki',  format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});

// VAPID public key = raw 65-byte uncompressed EC point (last 65 bytes of SPKI DER)
const rawPublicKey = publicKey.subarray(publicKey.length - 65);

// VAPID private key = raw 32-byte EC scalar.
// In PKCS8 DER the scalar sits after a 0x04 0x20 marker.
function extractRawPrivateScalar(pkcs8Der) {
  for (let i = 0; i < pkcs8Der.length - 33; i++) {
    if (pkcs8Der[i] === 0x04 && pkcs8Der[i + 1] === 0x20) {
      return pkcs8Der.subarray(i + 2, i + 34);
    }
  }
  throw new Error('Could not find raw private key scalar in PKCS8 DER');
}

function base64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const vapidPublicKey  = base64Url(rawPublicKey);
const vapidPrivateKey = base64Url(extractRawPrivateScalar(privateKey));

console.log('=== VAPID KEYS FOR DAIRYDROP ===\n');
console.log('Copy these into your .env AND Vercel Environment Variables:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidPublicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidPrivateKey}"`);
console.log(`VAPID_SUBJECT="mailto:support@dairydrop.in"\n`);
console.log('Public key length (should be 87):', vapidPublicKey.length);
console.log('Private key length (should be 43):', vapidPrivateKey.length);
