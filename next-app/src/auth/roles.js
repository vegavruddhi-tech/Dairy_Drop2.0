/**
 * Roles, permissions and the role→permission matrix.
 *
 * This module is the single source of truth for "who may do what". It is pure
 * data plus pure functions — no database, no session, no Next.js. That means it
 * can be unit-tested exhaustively and imported from middleware (edge runtime),
 * server components, server actions and route handlers alike.
 *
 * Three concepts, kept deliberately separate:
 *
 *   ROLE        Who you are.            CUSTOMER | MILKMAN | ADMIN
 *   PERMISSION  What action you may take. 'delivery:mark'
 *   SCOPE       Whose rows you may touch. OWN | TENANT | ALL
 *
 * Scope is what prevents cross-tenant leaks. A permission alone never grants
 * access to a row — the repository layer additionally narrows every query by
 * the caller's scope (see src/repositories/base.js). Forgetting the scope is
 * the mistake that the previous system made ~150 times; here it is structural.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Roles
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  MILKMAN: 'MILKMAN',
  ADMIN: 'ADMIN',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/** Where each role lands after sign-in, and which route group it owns. */
export const ROLE_HOME = Object.freeze({
  [ROLES.CUSTOMER]: '/dashboard',
  [ROLES.MILKMAN]: '/milkman',
  [ROLES.ADMIN]: '/admin',
});

// ─────────────────────────────────────────────────────────────────────────────
// Scopes
// ─────────────────────────────────────────────────────────────────────────────

export const SCOPES = Object.freeze({
  /** Only rows belonging to the acting user. */
  OWN: 'OWN',
  /** Only rows belonging to the acting user's tenant (a milkman's book). */
  TENANT: 'TENANT',
  /** Every row on the platform. */
  ALL: 'ALL',
});

/** Widest scope each role can ever hold. Used to sanity-check grants at boot. */
const MAX_SCOPE = Object.freeze({
  [ROLES.CUSTOMER]: SCOPES.OWN,
  [ROLES.MILKMAN]: SCOPES.TENANT,
  [ROLES.ADMIN]: SCOPES.ALL,
});

const SCOPE_RANK = Object.freeze({ [SCOPES.OWN]: 0, [SCOPES.TENANT]: 1, [SCOPES.ALL]: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
//
// Naming: '<resource>:<action>'. Resources are domain nouns, not tables.
// Keep this list closed — a permission that is not listed here cannot be granted.
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSIONS = Object.freeze({
  // ── Customer-facing ────────────────────────────────────────────────────────
  SUBSCRIPTION_READ: 'subscription:read',
  SUBSCRIPTION_CREATE: 'subscription:create',
  SUBSCRIPTION_PAUSE: 'subscription:pause',
  SUBSCRIPTION_CANCEL: 'subscription:cancel',

  DELIVERY_READ: 'delivery:read',
  DELIVERY_SKIP: 'delivery:skip',
  DELIVERY_ADJUST_QUANTITY: 'delivery:adjust-quantity',

  BILL_READ: 'bill:read',
  PAYMENT_SUBMIT: 'payment:submit',
  PAYMENT_READ: 'payment:read',

  PRODUCT_BROWSE: 'product:browse',
  PURCHASE_CREATE: 'purchase:create',
  PURCHASE_READ: 'purchase:read',

  PLAN_CHANGE_REQUEST: 'plan-change:request',
  PROFILE_MANAGE: 'profile:manage',
  ADDRESS_MANAGE: 'address:manage',
  NOTIFICATION_READ: 'notification:read',

  // ── Milkman-facing ─────────────────────────────────────────────────────────
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_APPROVE: 'customer:approve',
  CUSTOMER_REJECT: 'customer:reject',

  DELIVERY_MARK: 'delivery:mark',
  DELIVERY_BULK_DAY_OFF: 'delivery:bulk-day-off',

  MILK_PLAN_MANAGE: 'milk-plan:manage',
  PRODUCT_MANAGE: 'product:manage',
  PURCHASE_FULFIL: 'purchase:fulfil',

  PAYMENT_VERIFY: 'payment:verify',
  EARNINGS_READ: 'earnings:read',

  REQUEST_RESOLVE: 'request:resolve',
  BROADCAST_SEND: 'broadcast:send',

  SAAS_SUBSCRIBE: 'saas:subscribe',
  SAAS_STATUS_READ: 'saas:status-read',
  SERVICE_AREA_MANAGE: 'service-area:manage',

  // ── Admin-facing ───────────────────────────────────────────────────────────
  MILKMAN_READ: 'milkman:read',
  MILKMAN_VERIFY: 'milkman:verify',
  MILKMAN_SUSPEND: 'milkman:suspend',

  SAAS_PLAN_MANAGE: 'saas-plan:manage',
  SAAS_PAYMENT_READ: 'saas-payment:read',
  SAAS_PAYMENT_VERIFY: 'saas-payment:verify',

  PLATFORM_SETTINGS_MANAGE: 'platform-settings:manage',
  ANALYTICS_READ: 'analytics:read',
  AUDIT_READ: 'audit:read',
});

const PERMISSION_VALUES = new Set(Object.values(PERMISSIONS));

// ─────────────────────────────────────────────────────────────────────────────
// The matrix
//
// Each entry is [permission, scope]. Read it top-to-bottom as the complete,
// reviewable answer to "what can this role do?".
// ─────────────────────────────────────────────────────────────────────────────

const P = PERMISSIONS;
const { OWN, TENANT, ALL } = SCOPES;

const MATRIX = Object.freeze({
  [ROLES.CUSTOMER]: [
    [P.SUBSCRIPTION_READ, OWN],
    [P.SUBSCRIPTION_CREATE, OWN],
    [P.SUBSCRIPTION_PAUSE, OWN],
    [P.SUBSCRIPTION_CANCEL, OWN],
    [P.DELIVERY_READ, OWN],
    [P.DELIVERY_SKIP, OWN],
    [P.DELIVERY_ADJUST_QUANTITY, OWN],
    [P.BILL_READ, OWN],
    [P.PAYMENT_SUBMIT, OWN],
    [P.PAYMENT_READ, OWN],
    [P.PRODUCT_BROWSE, OWN],
    [P.PURCHASE_CREATE, OWN],
    [P.PURCHASE_READ, OWN],
    [P.PLAN_CHANGE_REQUEST, OWN],
    [P.PROFILE_MANAGE, OWN],
    [P.ADDRESS_MANAGE, OWN],
    [P.NOTIFICATION_READ, OWN],
    // Reading their *own* customer record — name, phone, address. OWN scope
    // narrows this to `users.id = actor.userId`.
    [P.CUSTOMER_READ, OWN],
  ],

  [ROLES.MILKMAN]: [
    [P.CUSTOMER_READ, TENANT],
    [P.CUSTOMER_UPDATE, TENANT],
    // The customer list, the round and billing all read subscriptions.
    [P.SUBSCRIPTION_READ, TENANT],
    [P.CUSTOMER_APPROVE, TENANT],
    [P.CUSTOMER_REJECT, TENANT],
    [P.DELIVERY_READ, TENANT],
    [P.DELIVERY_MARK, TENANT],
    [P.DELIVERY_ADJUST_QUANTITY, TENANT],
    [P.DELIVERY_BULK_DAY_OFF, TENANT],
    [P.MILK_PLAN_MANAGE, TENANT],
    [P.PRODUCT_MANAGE, TENANT],
    [P.PURCHASE_READ, TENANT],
    [P.PURCHASE_FULFIL, TENANT],
    [P.PAYMENT_READ, TENANT],
    [P.PAYMENT_VERIFY, TENANT],
    [P.EARNINGS_READ, OWN],
    [P.REQUEST_RESOLVE, TENANT],
    [P.BROADCAST_SEND, TENANT],
    [P.SAAS_SUBSCRIBE, OWN],
    [P.SAAS_STATUS_READ, OWN],
    [P.SERVICE_AREA_MANAGE, OWN],
    [P.PROFILE_MANAGE, OWN],
    [P.NOTIFICATION_READ, OWN],
    [P.BILL_READ, TENANT],
  ],

  [ROLES.ADMIN]: [
    [P.MILKMAN_READ, ALL],
    [P.MILKMAN_VERIFY, ALL],
    [P.MILKMAN_SUSPEND, ALL],
    [P.SAAS_PLAN_MANAGE, ALL],
    [P.SAAS_PAYMENT_READ, ALL],
    [P.SAAS_PAYMENT_VERIFY, ALL],
    [P.PLATFORM_SETTINGS_MANAGE, ALL],
    [P.ANALYTICS_READ, ALL],
    [P.AUDIT_READ, ALL],
    [P.CUSTOMER_READ, ALL], // read-only support view
    [P.NOTIFICATION_READ, OWN],
    [P.PROFILE_MANAGE, OWN],
  ],
});

/**
 * Boot-time integrity check. Catches typos and over-grants the moment the
 * module loads rather than at request time.
 */
function validateMatrix() {
  for (const [role, grants] of Object.entries(MATRIX)) {
    const seen = new Set();
    for (const [permission, scope] of grants) {
      if (!PERMISSION_VALUES.has(permission)) {
        throw new Error(`RBAC: role ${role} grants unknown permission "${permission}"`);
      }
      if (!SCOPE_RANK.hasOwnProperty(scope)) {
        throw new Error(`RBAC: role ${role} grants unknown scope "${scope}"`);
      }
      if (SCOPE_RANK[scope] > SCOPE_RANK[MAX_SCOPE[role]]) {
        throw new Error(
          `RBAC: role ${role} may not hold scope ${scope} (max ${MAX_SCOPE[role]}) for "${permission}"`,
        );
      }
      if (seen.has(permission)) {
        throw new Error(`RBAC: role ${role} grants "${permission}" twice`);
      }
      seen.add(permission);
    }
  }
}
validateMatrix();

/** Pre-computed `Map<role, Map<permission, scope>>` for O(1) lookups. */
const GRANTS = new Map(
  Object.entries(MATRIX).map(([role, grants]) => [role, new Map(grants)]),
);

// ─────────────────────────────────────────────────────────────────────────────
// Query API
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {boolean} whether `role` holds `permission` at any scope. */
export function roleHas(role, permission) {
  return GRANTS.get(role)?.has(permission) ?? false;
}

/** @returns {string|null} the scope at which `role` holds `permission`. */
export function scopeFor(role, permission) {
  return GRANTS.get(role)?.get(permission) ?? null;
}

/** @returns {string[]} every permission held by `role`, sorted. */
export function permissionsFor(role) {
  return [...(GRANTS.get(role)?.keys() ?? [])].sort();
}

/** @returns {boolean} true if `role` holds every permission in `required`. */
export function roleHasAll(role, required) {
  return required.every((p) => roleHas(role, p));
}

/** @returns {boolean} true if `role` holds at least one of `required`. */
export function roleHasAny(role, required) {
  return required.some((p) => roleHas(role, p));
}

/** True when `scope` is at least as wide as `minimum`. */
export function scopeCovers(scope, minimum) {
  return SCOPE_RANK[scope] >= SCOPE_RANK[minimum];
}

export function isValidRole(role) {
  return ROLE_VALUES.includes(role);
}

/** Flat snapshot of the whole matrix — used by the admin RBAC inspector. */
export function describeMatrix() {
  return Object.entries(MATRIX).map(([role, grants]) => ({
    role,
    maxScope: MAX_SCOPE[role],
    permissions: grants
      .map(([permission, scope]) => ({ permission, scope }))
      .sort((a, b) => a.permission.localeCompare(b.permission)),
  }));
}
