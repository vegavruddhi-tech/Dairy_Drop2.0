/**
 * Payment reference (UTR) validation.
 *
 * A milkman confirms a payment by finding its reference in their bank or UPI
 * app, so a reference that cannot exist is worse than none: it sends them
 * hunting for a transaction that was never made. The formats Indian payment
 * rails actually issue:
 *
 *   · UPI      — a 12-digit number (the UTR / RRN shown by GPay, PhonePe, Paytm)
 *   · IMPS     — also a 12-digit RRN
 *   · NEFT     — 16 characters: a 4-letter bank code, then 12 letters/digits
 *                (e.g. HDFCN52026091234)
 *   · RTGS     — 22 characters: a 4-letter bank code, then 18 letters/digits
 *
 * Spaces and dashes that apps insert for readability are removed and letters
 * upper-cased before checking, and the cleaned value is what gets stored — so
 * "4268 9102 8471" and "426891028471" are the same reference to the
 * duplicate check.
 *
 * Pure: no database, safe to import in the browser for live feedback.
 */

const UPI = /^\d{12}$/;
const NEFT = /^[A-Z]{4}[A-Z0-9]{12}$/;
const RTGS = /^[A-Z]{4}[A-Z0-9]{18}$/;

/** "4268 9102-8471" → "426891028471"; "hdfc n5..." → "HDFCN5...". */
export function normalizeReference(raw) {
  return String(raw ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

/**
 * Obviously made-up numbers: one digit repeated (000000000000) or a straight
 * run (123456789012, 987654321098). Real references are never either.
 */
function looksFake(value) {
  if (/^(.)\1+$/.test(value)) return true;
  if (!/^\d+$/.test(value)) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < value.length; i += 1) {
    const step = (Number(value[i]) - Number(value[i - 1]) + 10) % 10;
    if (step !== 1) up = false;
    if (step !== 9) down = false;
  }
  return up || down;
}

/**
 * @param {string} raw     what the person typed
 * @param {'UPI'|'BANK_TRANSFER'|'ANY'} [method]
 *   UPI accepts only the 12-digit UTR; BANK_TRANSFER and ANY (a platform
 *   payment, where the rail is not recorded) also accept NEFT and RTGS.
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
export function validateReference(raw, method = 'ANY') {
  const value = normalizeReference(raw);

  if (!value) {
    return { ok: false, message: 'Enter the UTR / transaction reference from your payment app.' };
  }
  if (!/^[A-Z0-9]+$/.test(value)) {
    return { ok: false, message: 'A UTR has only letters and digits — check for stray symbols.' };
  }

  const isUpi = UPI.test(value);
  const isBank = NEFT.test(value) || RTGS.test(value);

  if (method === 'UPI' && !isUpi) {
    return {
      ok: false,
      message: /^\d+$/.test(value)
        ? `A UPI UTR is exactly 12 digits — this has ${value.length}.`
        : 'A UPI UTR is 12 digits, no letters. Copy it from the payment details in GPay, PhonePe or Paytm.',
    };
  }
  if (method !== 'UPI' && !isUpi && !isBank) {
    return {
      ok: false,
      message:
        'That is not a valid UTR. UPI/IMPS: 12 digits. NEFT: 16 characters starting with 4 letters. RTGS: 22 characters starting with 4 letters.',
    };
  }
  if (looksFake(value)) {
    return { ok: false, message: 'That reference does not look real. Copy the UTR exactly as your app shows it.' };
  }

  return { ok: true, value };
}
