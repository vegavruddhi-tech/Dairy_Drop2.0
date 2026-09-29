import { describe, it, expect } from 'vitest';

import { likeContains } from './base.js';

describe('likeContains', () => {
  it('treats % and _ as literal characters', () => {
    expect(likeContains('%')).toBe('%\\%%');
    expect(likeContains('a_b')).toBe('%a\\_b%');
  });

  it('escapes a backslash before the wildcards it could otherwise un-escape', () => {
    expect(likeContains('50\\%')).toBe('%50\\\\\\%%');
  });

  it('trims, caps and skips empty terms', () => {
    expect(likeContains('  ram  ')).toBe('%ram%');
    expect(likeContains('')).toBeNull();
    expect(likeContains(undefined)).toBeNull();
    expect(likeContains('x'.repeat(500))).toHaveLength(102);
  });
});
