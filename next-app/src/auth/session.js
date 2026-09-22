/**
 * Server-side authorization guards.
 *
 * **Every** privileged operation enters through one of these. `middleware.js` is
 * a convenience that keeps users out of route groups they do not belong in; it
 * is not the control. A Server Action or Route Handler that does not call a
 * guard here is unprotected, because a client can invoke it directly regardless
 * of what the middleware said.
 *
 * ## Clerk's role, and this module's role
 *
 * Clerk answers "who is this?" — `auth()` returns a verified `userId`.
 * This module answers "what may they do?" — it resolves that Clerk id to the
 * application's `users` row and builds an `ActorContext` carrying role, tenant
 * and the account-state verdict.
 *
 * Nothing below this file knows Clerk exists. The repositories, services,
 * actions and the permission matrix all take an `ActorContext`, exactly as they
 * did before, which is why swapping the identity provider touched two files and
 * not a hundred.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server';

import { ROLES, ROLE_HOME, SCOPES, roleHas, scopeFor } from './roles.js';
import { evaluateGates, evaluateSaasAccess, GATE } from './policy.js';
import { findAccountByClerkId, upsertFromClerk } from './provision.js';
import {
  UnauthenticatedError,
  ForbiddenError,
  SubscriptionRequiredError,
} from '@/domain/errors.js';

/**
 * @typedef {object} ActorContext
 * @property {string} userId     the application's user id, not Clerk's
 * @property {string} clerkId
 * @property {string} email
 * @property {string} name
 * @property {string} role
 * @property {string|null} tenantId
 * @property {(permission: string) => boolean} can
 * @property {(permission: string) => string|null} scope
 */

/**
 * The current actor, memoised per request.
 *
 * `cache()` dedupes across a React render tree, so a layout and five nested
 * server components share one database lookup instead of six.
 *
 * Returns null when signed out.
 * @returns {Promise<ActorContext|null>}
 */
export const getActor = cache(async () => {
  const { userId: clerkId, isAuthenticated } = await clerkAuth();
  if (!isAuthenticated || !clerkId) return null;

  let account = await findAccountByClerkId(clerkId);

  // Lazy provisioning. The `user.created` webhook usually wins the race, but it
  // is eventually consistent — a brand-new user can land here first, and
  // "signed in but no account" is a confusing thing to show them.
  if (!account) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    account = await upsertFromClerk({
      clerkId,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses?.[0]?.emailAddress,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username,
      imageUrl: clerkUser.imageUrl,
      phone: clerkUser.primaryPhoneNumber?.phoneNumber,
    });
  }

  if (!account) return null;

  return buildActor(account);
});

/** Shape a database row into the context every layer below expects. */
function buildActor(account) {
  const role = account.role;

  return {
    userId: account.id,
    clerkId: account.clerkId,
    email: account.email,
    name: account.name,
    role,

    /**
     * The tenant this actor operates within.
     *
     *   MILKMAN  → themselves: they are the tenant
     *   CUSTOMER → the milkman who serves them
     *   ADMIN    → null: unscoped, which the repository layer reads as "all"
     */
    tenantId: role === ROLES.MILKMAN ? account.id : (account.milkmanId ?? null),

    approvalStatus: account.approvalStatus ?? null,
    isVerified: Boolean(account.isVerified),
    isActive: account.isActive !== false,

    can: (permission) => roleHas(role, permission),
    scope: (permission) => scopeFor(role, permission),
  };
}

/**
 * The serializable view of an actor, safe to pass into a Client Component.
 *
 * `ActorContext` carries `can()` and `scope()` — real functions, bound to the
 * permission matrix. React cannot serialize a function across the server→client
 * boundary, so handing a raw actor to a `'use client'` component throws
 * *"Functions cannot be passed directly to Client Components"*.
 *
 * Those methods are also deliberately kept enumerable rather than hidden: a loud
 * failure at the boundary is better than silently shipping an actor whose
 * permission checks have quietly become `undefined` on the client.
 *
 * Anything a client component needs about the viewer comes through here. Note
 * what is absent — no `userId`, no `tenantId`, no permission surface. A client
 * component has no business making authorization decisions; the server already
 * made them.
 *
 * @param {ActorContext|null} actor
 * @returns {{ name: string, email: string, role: string }|null}
 */
export function toViewer(actor) {
  if (!actor) return null;
  return {
    name: actor.name,
    email: actor.email,
    role: actor.role,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a guard should react when access is refused.
 *
 *   'render'  a page or layout is being rendered → redirect the person somewhere
 *             sensible. Being signed out, or standing in another role's area, is
 *             a routing outcome and not something worth a stack trace.
 *
 *   'action'  a Server Action or Route Handler → throw. Here the same condition
 *             means somebody invoked an operation they may not, which is a real
 *             event that should surface as an error.
 *
 * `defineAction` passes 'action'; everything else gets the 'render' default.
 * Next renders a layout and its page in parallel, so both see the refusal —
 * without this split, every ordinary wrong-area page view logged an exception
 * while the layout was already redirecting correctly.
 */
const RENDER = 'render';

/**
 * Require a signed-in account.
 *
 * @param {object} [options]
 * @param {'render'|'action'} [options.mode]
 * @returns {Promise<ActorContext>}
 */
export async function requireActor(options = {}) {
  const mode = options.mode ?? RENDER;
  const actor = await getActor();

  if (!actor) {
    if (mode === RENDER) redirect('/sign-in');
    throw new UnauthenticatedError();
  }

  if (!actor.isActive) {
    if (mode === RENDER) redirect('/sign-in');
    throw new ForbiddenError('This account has been disabled.');
  }

  return actor;
}

/**
 * Require a specific role.
 *
 * In render mode a mismatch sends the person to their *own* home rather than
 * showing an error — an admin who lands on a customer URL simply wants the
 * admin console.
 *
 * @param {string|string[]} roles
 * @param {object} [options]
 * @param {'render'|'action'} [options.mode]
 */
export async function requireRole(roles, options = {}) {
  const mode = options.mode ?? RENDER;
  const actor = await requireActor(options);
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!allowed.includes(actor.role)) {
    if (mode === RENDER) redirect(ROLE_HOME[actor.role] ?? '/');
    throw new ForbiddenError('You do not have access to this area.', {
      required: allowed,
      actual: actor.role,
    });
  }

  return actor;
}

/**
 * Require a permission. The primary guard — most call sites use this one.
 *
 * @param {string} permission  a value from PERMISSIONS
 * @param {object} [options]
 * @param {string} [options.minimumScope]  reject a grant narrower than this
 */
export async function requirePermission(permission, options = {}) {
  const actor = await requireActor(options);

  if (!actor.can(permission)) {
    throw new ForbiddenError('You do not have permission to do that.', {
      permission,
      role: actor.role,
    });
  }

  if (options.minimumScope) {
    const granted = actor.scope(permission);
    const rank = { [SCOPES.OWN]: 0, [SCOPES.TENANT]: 1, [SCOPES.ALL]: 2 };
    if (rank[granted] < rank[options.minimumScope]) {
      throw new ForbiddenError('Your access is too narrow for that action.', {
        permission,
        granted,
        required: options.minimumScope,
      });
    }
  }

  return actor;
}

/** Require an approved customer — role check plus the account-state gates. */
export async function requireCustomer(options = {}) {
  const mode = options.mode ?? RENDER;
  const actor = await requireRole(ROLES.CUSTOMER, options);

  const verdict = evaluateGates({
    role: actor.role,
    isActive: actor.isActive,
    approvalStatus: actor.approvalStatus,
    milkmanId: actor.tenantId,
  });

  if (!verdict.ok) {
    // The gate already knows where an unapproved customer should go.
    if (mode === RENDER) redirect(verdict.redirect ?? '/pending');
    throw new ForbiddenError(verdict.message, {
      gate: verdict.gate,
      redirect: verdict.redirect,
    });
  }

  return actor;
}

/**
 * Require a milkman who is verified **and** currently paying.
 *
 * This is the paywall, enforced on the server, on every call. It costs one
 * indexed lookup — worth it, because the alternative is the client being the
 * only thing between an expired trial and full access.
 *
 * @param {object} [options]
 * @param {boolean} [options.allowUnpaid]  for the activation screen itself,
 *   which a paywalled milkman must still be able to reach
 */
export async function requireMilkman(options = {}) {
  const mode = options.mode ?? RENDER;
  const actor = await requireRole(ROLES.MILKMAN, options);

  if (!actor.isVerified && !options.allowUnpaid) {
    if (mode === RENDER) redirect('/milkman/activate');
    throw new SubscriptionRequiredError(
      GATE.MILKMAN_UNVERIFIED,
      'Your business is awaiting verification by the DairyDrop team.',
    );
  }

  const { findCurrentSaasSubscription } = await import('@/repositories/saas.repo.js');
  const saas = await findCurrentSaasSubscription(actor.userId);

  if (!options.allowUnpaid) {
    const verdict = evaluateSaasAccess(saas);
    if (!verdict.ok) {
      if (mode === RENDER) redirect('/milkman/activate');
      const { GATE_MESSAGE } = await import('./policy.js');
      throw new SubscriptionRequiredError(verdict.gate, GATE_MESSAGE[verdict.gate]);
    }
  }

  return { ...actor, saas };
}

/** Require a platform administrator. */
export async function requireAdmin(options = {}) {
  return requireRole(ROLES.ADMIN, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-throwing variants, for rendering decisions
// ─────────────────────────────────────────────────────────────────────────────

/** `true` if the current actor holds `permission`. Never throws. */
export async function can(permission) {
  const actor = await getActor();
  return actor?.can(permission) ?? false;
}

/**
 * Evaluate the account-state gates without throwing.
 * Layouts use this to choose between the app and a blocking screen.
 */
export async function gateStatus() {
  const actor = await getActor();
  if (!actor) return { ok: false, gate: 'UNAUTHENTICATED', redirect: '/sign-in' };

  if (actor.role === ROLES.MILKMAN) {
    const { findCurrentSaasSubscription } = await import('@/repositories/saas.repo.js');
    const saas = await findCurrentSaasSubscription(actor.userId);
    return evaluateGates({
      role: actor.role,
      isActive: actor.isActive,
      isVerified: actor.isVerified,
      saas,
    });
  }

  return evaluateGates({
    role: actor.role,
    isActive: actor.isActive,
    approvalStatus: actor.approvalStatus,
    milkmanId: actor.tenantId,
  });
}

export { ROLES, SCOPES };
