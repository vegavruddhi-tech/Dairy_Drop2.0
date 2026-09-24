/**
 * Milk plans and customer subscriptions.
 *
 * Subscriptions are versioned: `effectiveTo IS NULL` is the current version, and
 * versions of one logical subscription share `rootId`. Reads almost always want
 * the current version; billing wants every version overlapping a month.
 */

import 'server-only';
import { and, eq, gt, gte, lte, lt, isNull, or, desc, asc, sql, inArray } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { milkPlans, milkSubscriptions, users } from '@/db/schema/index.js';
import { PERMISSIONS } from '@/auth/roles.js';
import { scoped } from './base.js';
import { monthStart, nextMonthStart } from '@/domain/dates.js';

const planScope = { tenant: milkPlans.milkmanId };
const subScope = { tenant: milkSubscriptions.milkmanId, owner: milkSubscriptions.customerId };

// ── Plans ────────────────────────────────────────────────────────────────────

/** A milkman's catalog. */
export async function listPlans(actor, { activeOnly = false } = {}) {
  return db
    .select()
    .from(milkPlans)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.MILK_PLAN_MANAGE, columns: planScope },
        activeOnly ? eq(milkPlans.isActive, true) : undefined,
      ),
    )
    .orderBy(asc(milkPlans.monthlyPrice), asc(milkPlans.pricePerDelivery));
}

/**
 * Plans a customer may subscribe to — their own milkman's only.
 *
 * Scoped by the *customer's* tenant, so a customer can never see, quote or
 * subscribe to another milkman's catalog. The previous system enforced this
 * correctly and it is worth preserving explicitly.
 */
export async function listPlansForCustomer(actor) {
  if (!actor.tenantId) return [];
  return db
    .select()
    .from(milkPlans)
    .where(and(eq(milkPlans.milkmanId, actor.tenantId), eq(milkPlans.isActive, true)))
    .orderBy(asc(milkPlans.quantity));
}

/** Public / Signup helper to list active plans for a given milkman */
export async function listActivePlansForMilkman(milkmanId) {
  return db
    .select()
    .from(milkPlans)
    .where(and(eq(milkPlans.milkmanId, milkmanId), eq(milkPlans.isActive, true)))
    .orderBy(asc(milkPlans.monthlyPrice), asc(milkPlans.pricePerDelivery));
}

export async function findPlan(actor, planId) {
  const [row] = await db
    .select()
    .from(milkPlans)
    .where(
      and(
        eq(milkPlans.id, planId),
        // A customer resolves plans through their tenant; a milkman through theirs.
        eq(milkPlans.milkmanId, actor.tenantId ?? actor.userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createPlan(tx, values) {
  const [row] = await tx.insert(milkPlans).values(values).returning();
  return row;
}

export async function updatePlan(tx, actor, { id, patch }) {
  const [row] = await tx
    .update(milkPlans)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.MILK_PLAN_MANAGE, columns: planScope },
        eq(milkPlans.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Everyone currently on a plan, with the details a notification needs.
 *
 * Only versions still in force: a superseded or cancelled one has
 * `effective_to` set and its customer has already moved on.
 */
export async function listSubscribersOfPlan(tx, actor, planId) {
  return tx
    .select({
      rootId: milkSubscriptions.rootId,
      versionId: milkSubscriptions.id,
      customerId: milkSubscriptions.customerId,
      milkmanId: milkSubscriptions.milkmanId,
      productName: milkSubscriptions.productName,
      status: milkSubscriptions.status,
    })
    .from(milkSubscriptions)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_READ, columns: subScope },
        eq(milkSubscriptions.planId, planId),
        isNull(milkSubscriptions.effectiveTo),
        inArray(milkSubscriptions.status, ['ACTIVE', 'PAUSED']),
      ),
    );
}

/** How many people a retire would affect. Drives the confirmation. */
export async function countSubscribersOfPlan(actor, planId) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(milkSubscriptions)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_READ, columns: subScope },
        eq(milkSubscriptions.planId, planId),
        isNull(milkSubscriptions.effectiveTo),
        inArray(milkSubscriptions.status, ['ACTIVE', 'PAUSED']),
      ),
    );
  return row?.count ?? 0;
}

/**
 * Take a plan out of the catalog, rather than deleting the row.
 *
 * Deleting would break the audit trail on every enrolment that ever pointed at
 * it. Ending the subscriptions on it is a separate step — see
 * `subscriptionService.retirePlan`, which owns that decision.
 */
export async function retirePlan(tx, actor, id) {
  return updatePlan(tx, actor, { id, patch: { isActive: false } });
}

/**
 * Remove a plan outright.
 *
 * Safe for history because every enrolment snapshots its terms and every
 * delivery its price; `milk_subscriptions.plan_id` is `ON DELETE SET NULL`,
 * so old bills still add up. The service ends anyone still on the plan first —
 * a live subscription with no plan behind it would keep generating deliveries.
 */
export async function deletePlan(tx, actor, id) {
  const [row] = await tx
    .delete(milkPlans)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.MILK_PLAN_MANAGE, columns: planScope },
        eq(milkPlans.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

/** Current versions for one customer. */
export async function listCurrentForCustomer(actor, customerId) {
  return db
    .select()
    .from(milkSubscriptions)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_READ, columns: subScope },
        eq(milkSubscriptions.customerId, customerId),
        isNull(milkSubscriptions.effectiveTo),
      ),
    )
    .orderBy(asc(milkSubscriptions.createdAt));
}

/** Current version by root id, within scope. */
export async function findCurrentByRoot(actor, rootId) {
  const [row] = await db
    .select()
    .from(milkSubscriptions)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_READ, columns: subScope },
        eq(milkSubscriptions.rootId, rootId),
        isNull(milkSubscriptions.effectiveTo),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Every version overlapping a month.
 *
 * Billing uses this so a month that spans a plan change charges each part at the
 * price that was actually in force. The previous system rewrote the subscription
 * in place and billed the whole month at the new price.
 */
export async function listVersionsForMonth(actor, { customerId, month }) {
  const from = monthStart(month);
  const to = nextMonthStart(month);

  return db
    .select()
    .from(milkSubscriptions)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_READ, columns: subScope },
        eq(milkSubscriptions.customerId, customerId),
        lt(milkSubscriptions.effectiveFrom, to),
        or(isNull(milkSubscriptions.effectiveTo), gte(milkSubscriptions.effectiveTo, from)),
      ),
    )
    .orderBy(asc(milkSubscriptions.effectiveFrom));
}

/** Active subscriptions due to generate deliveries on `date`. Job-side, unscoped. */
export async function listGenerable(tx, date) {
  return tx
    .select({
      rootId: milkSubscriptions.rootId,
      versionId: milkSubscriptions.id,
      customerId: milkSubscriptions.customerId,
      milkmanId: milkSubscriptions.milkmanId,
      productName: milkSubscriptions.productName,
      quantity: milkSubscriptions.quantity,
      unit: milkSubscriptions.unit,
      unitPrice: milkSubscriptions.unitPrice,
      frequency: milkSubscriptions.frequency,
      slot: milkSubscriptions.slot,
      effectiveFrom: milkSubscriptions.effectiveFrom,
    })
    .from(milkSubscriptions)
    .innerJoin(users, eq(users.id, milkSubscriptions.customerId))
    .where(
      and(
        eq(milkSubscriptions.status, 'ACTIVE'),
        isNull(milkSubscriptions.effectiveTo),
        lte(milkSubscriptions.effectiveFrom, date),
        // Only approved, active customers receive milk.
        eq(users.approvalStatus, 'APPROVED'),
        eq(users.isActive, true),
      ),
    );
}

/** Count a milkman's active customers — the number the plan limit applies to. */
export async function countActiveCustomers(tx, milkmanId) {
  const [row] = await tx
    .select({ count: sql`count(distinct ${users.id})::int` })
    .from(users)
    .where(
      and(
        eq(users.milkmanId, milkmanId),
        eq(users.role, 'CUSTOMER'),
        eq(users.approvalStatus, 'APPROVED'),
        eq(users.isActive, true),
      ),
    );
  return row?.count ?? 0;
}

export async function insertSubscription(tx, values) {
  const [row] = await tx.insert(milkSubscriptions).values(values).returning();
  return row;
}

/** Close the current version at `effectiveTo`. Half of a plan change. */
/**
 * Amend a version that has not taken effect yet.
 *
 * Normally terms are changed by closing the current version and opening a
 * successor, so a month spanning the change bills each part at the price that
 * was in force. A version whose `effective_from` is still in the future has
 * never been in force and has delivered nothing, so there is no history for a
 * successor to protect — and stacking one is not merely wasteful, it is
 * impossible: closing it "at the end of today" would end it before it began,
 * which `milk_subs_range` correctly refuses.
 *
 * Guarded on `effective_from > :today` so this can never touch a live version.
 */
export async function amendPendingVersion(tx, { id, today, patch }) {
  const [row] = await tx
    .update(milkSubscriptions)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(milkSubscriptions.id, id),
        isNull(milkSubscriptions.effectiveTo),
        gt(milkSubscriptions.effectiveFrom, today),
      ),
    )
    .returning();
  return row ?? null;
}

export async function closeVersion(tx, { id, effectiveTo, status = 'SUPERSEDED' }) {
  const [row] = await tx
    .update(milkSubscriptions)
    .set({ effectiveTo, status, updatedAt: new Date() })
    .where(and(eq(milkSubscriptions.id, id), isNull(milkSubscriptions.effectiveTo)))
    .returning();
  return row ?? null;
}

export async function setStatus(tx, actor, { rootId, status, patch = {} }) {
  const [row] = await tx
    .update(milkSubscriptions)
    .set({ status, ...patch, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_PAUSE, columns: subScope },
        eq(milkSubscriptions.rootId, rootId),
        isNull(milkSubscriptions.effectiveTo),
      ),
    )
    .returning();
  return row ?? null;
}

/** Subscription summaries for a milkman's customer list. */
export async function summariseByCustomer(actor, customerIds) {
  if (customerIds.length === 0) return new Map();

  const rows = await db
    .select({
      customerId: milkSubscriptions.customerId,
      count: sql`count(*)::int`,
      totalQuantity: sql`coalesce(sum(${milkSubscriptions.quantity}), 0)`,
      totalMonthly: sql`coalesce(sum(${milkSubscriptions.quotedMonthlyPrice}), 0)`,
      productNames: sql`string_agg(${milkSubscriptions.productName}, ', ' order by ${milkSubscriptions.createdAt})`,
    })
    .from(milkSubscriptions)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.SUBSCRIPTION_READ, columns: subScope },
        inArray(milkSubscriptions.customerId, customerIds),
        isNull(milkSubscriptions.effectiveTo),
        eq(milkSubscriptions.status, 'ACTIVE'),
      ),
    )
    .groupBy(milkSubscriptions.customerId);

  return new Map(rows.map((r) => [r.customerId, r]));
}
