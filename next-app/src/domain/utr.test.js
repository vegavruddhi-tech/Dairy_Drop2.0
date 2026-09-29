import { describe, it, expect } from 'vitest';

import { validateReference, normalizeReference } from './utr.js';

describe('UTR validation', () => {
  it('accepts a 12-digit UPI UTR, with or without the spaces apps add', () => {
    expect(validateReference('426891028471', 'UPI')).toEqual({ ok: true, value: '426891028471' });
    expect(validateReference(' 4268 9102-8471 ', 'UPI')).toEqual({ ok: true, value: '426891028471' });
  });

  it('refuses letters, symbols and the wrong length for UPI', () => {
    expect(validateReference('ABC123', 'UPI').ok).toBe(false);
    expect(validateReference('42689102847', 'UPI').message).toMatch(/12 digits — this has 11/);
    expect(validateReference('4268910284712', 'UPI').ok).toBe(false);
    expect(validateReference('426891#28471', 'UPI').message).toMatch(/letters and digits/);
    // A NEFT reference is not a UPI UTR.
    expect(validateReference('HDFCN52026091234', 'UPI').ok).toBe(false);
  });

  it('accepts IMPS, NEFT and RTGS for a bank transfer', () => {
    expect(validateReference('426891028471', 'BANK_TRANSFER').ok).toBe(true);
    expect(validateReference('hdfcn52026091234', 'BANK_TRANSFER')).toEqual({ ok: true, value: 'HDFCN52026091234' });
    expect(validateReference('SBINR52026092912345678', 'BANK_TRANSFER').ok).toBe(true);
    expect(validateReference('HDFC1234', 'BANK_TRANSFER').ok).toBe(false);
    expect(validateReference('1234HDFCN5202609', 'BANK_TRANSFER').ok).toBe(false);
  });

  it('refuses obviously made-up numbers', () => {
    expect(validateReference('000000000000', 'UPI').ok).toBe(false);
    expect(validateReference('123456789012', 'UPI').ok).toBe(false);
    expect(validateReference('987654321098', 'UPI').ok).toBe(false);
  });

  it('refuses an empty reference', () => {
    expect(validateReference('', 'ANY').ok).toBe(false);
    expect(validateReference(undefined, 'UPI').ok).toBe(false);
    expect(normalizeReference(null)).toBe('');
  });
});
