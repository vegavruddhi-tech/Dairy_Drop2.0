import { describe, it, expect } from 'vitest';

import { isCronAuthorized } from './cron-secret.js';

describe('cron secret check', () => {
  const secret = 'a-long-random-cron-secret-0123456789';

  it('accepts the right secret', () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
  });

  it('refuses a wrong secret of the same length', () => {
    expect(isCronAuthorized(`Bearer ${secret.replace(/.$/, 'x')}`, secret)).toBe(false);
  });

  it('refuses a secret of a different length without throwing', () => {
    expect(isCronAuthorized('Bearer short', secret)).toBe(false);
    expect(isCronAuthorized(`Bearer ${secret}${secret}`, secret)).toBe(false);
  });

  it('refuses a missing or malformed header', () => {
    expect(isCronAuthorized(null, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(`Basic ${secret}`, secret)).toBe(false);
  });

  it('is closed when no secret is configured', () => {
    expect(isCronAuthorized('Bearer anything', undefined)).toBe(false);
    expect(isCronAuthorized('Bearer ', '')).toBe(false);
  });
});
