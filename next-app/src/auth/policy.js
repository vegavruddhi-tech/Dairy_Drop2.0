/**
 * Access gates that sit *above* RBAC.
 *
 * RBAC answers "does this role have this permission". These policies answer the
 * separate question "is this particular account currently allowed to operate at
 * all". They are account-state gates, not permission checks, and they are the
 * reason the old system leaked paid access: its paywall lived only in the React
 * client. Here every gate is evaluated server-side, in one place, and the result
 * is attached to the session.
 *
 * Pure functions — they take plain data and return a verdict. No I/O.
 */

import { ROLES } from './roles.js';

/** Why access was denied. The UI maps these to screens. */
export const GATE = Object.freeze({
  OK: 'OK',
  /** Customer registered but the milkman has not approved them yet. */
  CUSTOMER_PENDING: 'CUSTOMER_PENDING',
  /** Customer was rejected by their milkman. */
  CUSTOMER_REJECTED: 'CUSTOMER_REJECTED',
  /** Customer has no milkman assigned — incomplete onboarding. */
  CUSTOMER_UNASSIGNED: 'CUSTOMER_UNASSIGNED',
  /** Milkman exists but an admin has not verified the business. */
  MILKMAN_UNVERIFIED: 'MILKMAN_UNVERIFIED',
  /** Milkman has never started a trial or plan. */
  SAAS_NONE: 'SAAS_NONE',
  /** Free trial has run out. */
  SAAS_TRIAL_EXPIRED: 'SAAS_TRIAL_EXPIRED',
  /** Paid plan has run out. */
  SAAS_EXPIRED: 'SAAS_EXPIRED',
  /** UTR submitted, awaiting an admin. */
  SAAS_PENDING_VERIFICATION: 'SAAS_PENDING_VERIFICATION',
  /** Subscription cancelled, by the milkman or by admin suspension. */
  SAAS_CANCELLED: 'SAAS_CANCELLED',
  /** Account disabled. */
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
});

/** Where the UI should send a blocked user, per gate. */
export const GATE_REDIRECT = Object.freeze({
  [GATE.CUSTOMER_PENDING]: '/pending',
  [GATE.CUSTOMER_REJECTED]: '/pending',
  [GATE.CUSTOMER_UNASSIGNED]: '/register',
  [GATE.MILKMAN_UNVERIFIED]: '/milkman/activate',
  [GATE.SAAS_NONE]: '/milkman/activate',
  [GATE.SAAS_TRIAL_EXPIRED]: '/milkman/activate',
  [GATE.SAAS_EXPIRED]: '/milkman/activate',
  [GATE.SAAS_PENDING_VERIFICATION]: '/milkman/activate',
  [GATE.SAAS_CANCELLED]: '/milkman/activate',
  [GATE.ACCOUNT_INACTIVE]: '/sign-in',
});

/** Human-readable reason, shown on the blocking screen. */
export const GATE_MESSAGE = Object.freeze({
  [GATE.CUSTOMER_PENDING]:
    'Your registration is waiting for your milkman to approve it.',
  [GATE.CUSTOMER_REJECTED]:
    'Your registration was not approved. Please contact your milkman.',
  [GATE.CUSTOMER_UNASSIGNED]:
    'Finish choosing a milkman to complete your registration.',
  [GATE.MILKMAN_UNVERIFIED]:
    'Your business is awaiting verification by the DairyDrop team.',
  [GATE.SAAS_NONE]: 'Start your free trial or choose a plan to open your panel.',
  [GATE.SAAS_TRIAL_EXPIRED]:
    'Your 7-day free trial has ended. Choose a plan to continue.',
  [GATE.SAAS_EXPIRED]: 'Your plan has expired. Renew it to continue.',
  [GATE.SAAS_PENDING_VERIFICATION]:
    'We have your payment reference and are verifying it. This usually takes a few hours.',
  [GATE.SAAS_CANCELLED]:
    'Your subscription is no longer active. Choose a plan to continue.',
  [GATE.ACCOUNT_INACTIVE]: 'This account has been disabled.',
});

/** These gates still allow reaching the activation screen to fix the problem. */
const RECOVERABLE = new Set([
  GATE.SAAS_NONE,
  GATE.SAAS_TRIAL_EXPIRED,
  GATE.SAAS_EXPIRED,
  GATE.SAAS_PENDING_VERIFICATION,
  GATE.SAAS_CANCELLED,
  GATE.MILKMAN_UNVERIFIED,
]);

export function isRecoverable(gate) {
  return RECOVERABLE.has(gate);
}

/**
 * Evaluate every gate for an account.
 *
 * @param {object} account
 * @param {string}  account.role
 * @param {boolean} account.isActive
 * @param {string}  [account.approvalStatus]  PENDING | APPROVED | REJECTED
 * @param {string}  [account.milkmanId]       the customer's assigned milkman
 * @param {boolean} [account.isVerified]      milkman business verification
 * @param {object}  [account.saas]            the milkman's current subscription
 * @param {Date}    [now]
 * @returns {{ gate: string, ok: boolean, message: string|null, redirect: string|null }}
 */
export function evaluateGates(account, now = new Date()) {
  const deny = (gate) => ({
    gate,
    ok: false,
    message: GATE_MESSAGE[gate] ?? 'Access denied.',
    redirect: GATE_REDIRECT[gate] ?? '/sign-in',
  });

  if (account.isActive === false) return deny(GATE.ACCOUNT_INACTIVE);

  if (account.role === ROLES.CUSTOMER) {
    if (account.approvalStatus === 'REJECTED') return deny(GATE.CUSTOMER_REJECTED);
    if (account.approvalStatus === 'PENDING') return deny(GATE.CUSTOMER_PENDING);
    if (!account.milkmanId) return deny(GATE.CUSTOMER_UNASSIGNED);
  }

  if (account.role === ROLES.MILKMAN) {
    if (!account.isVerified) return deny(GATE.MILKMAN_UNVERIFIED);

    const verdict = evaluateSaasAccess(account.saas, now);
    if (!verdict.ok) return deny(verdict.gate);
  }

  // ADMIN has no additional gates — the email allowlist is the gate.

  return { gate: GATE.OK, ok: true, message: null, redirect: null };
}

/**
 * The paywall, as a pure function.
 *
 * This is the rule the old system wrote and never mounted. Treat a subscription
 * as live only when it is a trial or an active plan whose end date is still in
 * the future. Nothing else — in particular, never expire a subscription for
 * lacking a payment reference, which is the bug that locked out paying milkmen
 * on day 8.
 *
 * @param {object|null|undefined} saas
 * @param {Date} now
 */
export function evaluateSaasAccess(saas, now = new Date()) {
  if (!saas) return { ok: false, gate: GATE.SAAS_NONE };

  const endsAt = saas.endsAt ? new Date(saas.endsAt) : null;
  const expired = !endsAt || endsAt.getTime() <= now.getTime();

  switch (saas.status) {
    case 'TRIAL':
      return expired
        ? { ok: false, gate: GATE.SAAS_TRIAL_EXPIRED }
        : { ok: true, gate: GATE.OK };

    case 'ACTIVE':
      return expired
        ? { ok: false, gate: GATE.SAAS_EXPIRED }
        : { ok: true, gate: GATE.OK };

    case 'PENDING_VERIFICATION':
      return { ok: false, gate: GATE.SAAS_PENDING_VERIFICATION };

    case 'EXPIRED':
      return {
        ok: false,
        gate: saas.planId ? GATE.SAAS_EXPIRED : GATE.SAAS_TRIAL_EXPIRED,
      };

    case 'CANCELLED':
      return { ok: false, gate: GATE.SAAS_CANCELLED };

    default:
      return { ok: false, gate: GATE.SAAS_NONE };
  }
}

/**
 * Whole days remaining on a subscription, floored at 0.
 * Used for the "3 days left" nudge, never for access decisions.
 */
export function daysRemaining(saas, now = new Date()) {
  if (!saas?.endsAt) return 0;
  const ms = new Date(saas.endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
