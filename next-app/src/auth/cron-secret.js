/**
 * The cron endpoint's shared-secret check.
 *
 * Compared in constant time. Both sides are hashed first: `timingSafeEqual`
 * throws on inputs of different lengths, and checking the length beforehand
 * would itself leak how long the secret is. SHA-256 digests are always 32
 * bytes, so the comparison never short-circuits.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value) => createHash('sha256').update(value, 'utf8').digest();

/**
 * @param {string|null} header  the raw `Authorization` header
 * @param {string|undefined} secret  `CRON_SECRET`
 */
export function isCronAuthorized(header, secret) {
  // No secret configured means the endpoint is closed, not open.
  if (!secret) return false;
  const match = /^Bearer (.+)$/.exec(header ?? '');
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret));
}
