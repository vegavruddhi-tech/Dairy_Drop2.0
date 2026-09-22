/**
 * Tenant scoping.
 *
 * The previous system isolated milkmen from one another with roughly 150
 * hand-written `.eq('milkman_id', …)` clauses, connected to Postgres with the
 * service-role key (so RLS was bypassed), and defined zero RLS policies. A
 * single forgotten filter was a cross-tenant data leak with no second line of
 * defence.
 *
 * Here the filter is not something you remember — it is something you cannot
 * omit. Every scoped query is built through `tenantFilter`, which *requires* an
 * ActorContext and derives the predicate from the actor's role and the scope at
 * which they hold the permission. Passing no actor throws; passing an actor with
 * no tenant and no ALL scope throws.
 *
 * Belt and braces: the SQL in `src/db/rls.sql` adds real row-level security for
 * deployments that can run the application under a non-superuser role. This
 * module is the braces.
 */

import { and, eq, or, isNull } from 'drizzle-orm';

import { ROLES, SCOPES, scopeFor } from '@/auth/roles.js';
import { ForbiddenError } from '@/domain/errors.js';

/**
 * Build the WHERE predicate that confines a query to what `actor` may see.
 *
 * @param {object} options
 * @param {import('@/auth/session.js').ActorContext} options.actor
 * @param {string} options.permission  the permission being exercised
 * @param {object} options.columns
 * @param {object} [options.columns.tenant]  the table's `milkman_id` column
 * @param {object} [options.columns.owner]   the table's user column (`customer_id`, `user_id`, …)
 * @returns {object|undefined} a Drizzle predicate, or undefined for unrestricted access
 */
export function tenantFilter({ actor, permission, columns }) {
  if (!actor) {
    throw new ForbiddenError('A query was built without an actor. This is a bug.');
  }

  const scope = scopeFor(actor.role, permission);
  if (!scope) {
    throw new ForbiddenError('You do not have permission to do that.', {
      permission,
      role: actor.role,
    });
  }

  switch (scope) {
    case SCOPES.ALL:
      // Administrators read across tenants. Nothing to add.
      return undefined;

    case SCOPES.TENANT: {
      if (!columns.tenant) {
        throw new ForbiddenError(
          `Permission "${permission}" is TENANT-scoped but the table has no tenant column. This is a bug.`,
        );
      }
      if (!actor.tenantId) {
        throw new ForbiddenError('Your account is not linked to a milkman.');
      }
      return eq(columns.tenant, actor.tenantId);
    }

    case SCOPES.OWN: {
      // A customer sees their own rows. On tables keyed by `customer_id` that
      // is the owner column; on a milkman's own-scope tables (earnings, profile)
      // it is the tenant column.
      if (columns.owner) return eq(columns.owner, actor.userId);
      if (columns.tenant) return eq(columns.tenant, actor.userId);
      throw new ForbiddenError(
        `Permission "${permission}" is OWN-scoped but the table has no owner column. This is a bug.`,
      );
    }

    default:
      throw new ForbiddenError(`Unknown scope: ${scope}`);
  }
}

/**
 * Compose a tenant filter with the caller's own predicates.
 *
 * Usage:
 *   const rows = await db.select().from(deliveries).where(
 *     scoped({ actor, permission: PERMISSIONS.DELIVERY_READ,
 *              columns: { tenant: deliveries.milkmanId, owner: deliveries.customerId } },
 *            eq(deliveries.deliveryDate, date)),
 *   );
 */
export function scoped(scopeSpec, ...predicates) {
  const filter = tenantFilter(scopeSpec);
  const all = [filter, ...predicates].filter(Boolean);
  if (all.length === 0) return undefined;
  return all.length === 1 ? all[0] : and(...all);
}

/**
 * Assert that a row the caller already holds is within their scope.
 *
 * For `UPDATE … WHERE id = ?` the scope predicate goes in the WHERE clause, and
 * zero affected rows is indistinguishable from "not found" — which is the
 * behaviour we want (never confirm that another tenant's row exists). Use this
 * when a row has already been read and a decision depends on ownership.
 */
export function assertWithinScope({ actor, permission, row, tenantKey = 'milkmanId', ownerKey = 'customerId' }) {
  const scope = scopeFor(actor.role, permission);

  if (scope === SCOPES.ALL) return;

  if (scope === SCOPES.TENANT) {
    if (row?.[tenantKey] !== actor.tenantId) {
      throw new ForbiddenError('That record belongs to another account.');
    }
    return;
  }

  if (scope === SCOPES.OWN) {
    const ownerId = row?.[ownerKey] ?? row?.[tenantKey];
    if (ownerId !== actor.userId) {
      throw new ForbiddenError('That record belongs to another account.');
    }
    return;
  }

  throw new ForbiddenError('You do not have permission to do that.', { permission });
}

/**
 * The tenant a write should be attributed to.
 *
 * A milkman writes into their own book; a customer writes into their milkman's.
 * Never take a tenant id from request input — that is how a client escalates
 * into another tenant's data.
 */
export function writeTenantId(actor) {
  if (actor.role === ROLES.MILKMAN) return actor.userId;
  if (actor.role === ROLES.CUSTOMER) {
    if (!actor.tenantId) throw new ForbiddenError('Your account is not linked to a milkman.');
    return actor.tenantId;
  }
  throw new ForbiddenError('Administrators cannot write tenant-owned records.');
}

/** Paging with a hard ceiling, so a client cannot ask for the whole table. */
export function paginate({ limit = 50, offset = 0 } = {}, max = 200) {
  return {
    limit: Math.min(Math.max(1, Number(limit) || 50), max),
    offset: Math.max(0, Number(offset) || 0),
  };
}

export { and, eq, or, isNull };
