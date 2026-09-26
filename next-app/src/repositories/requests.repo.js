/**
 * Quantity-change and plan-change requests.
 */

import 'server-only';
import { and, eq, desc, asc, sql } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { quantityChangeRequests, planChangeRequests, users, milkPlans, deliveries } from '@/db/schema/index.js';
import { PERMISSIONS } from '@/auth/roles.js';
import { scoped, paginate } from './base.js';

const qcrScope = { tenant: quantityChangeRequests.milkmanId, owner: quantityChangeRequests.customerId };
const pcrScope = { tenant: planChangeRequests.milkmanId, owner: planChangeRequests.customerId };

// ── Quantity changes ─────────────────────────────────────────────────────────

export async function createQuantityRequest(tx, values) {
  const [row] = await tx.insert(quantityChangeRequests).values(values).returning();
  return row;
}

export async function listQuantityRequests(actor, { status, ...page } = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select({
      id: quantityChangeRequests.id,
      customerId: quantityChangeRequests.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      deliveryId: quantityChangeRequests.deliveryId,
      deliveryDate: quantityChangeRequests.deliveryDate,
      productName: deliveries.productName,
      unit: deliveries.unit,
      currentQuantity: quantityChangeRequests.currentQuantity,
      requestedQuantity: quantityChangeRequests.requestedQuantity,
      status: quantityChangeRequests.status,
      customerNote: quantityChangeRequests.customerNote,
      milkmanNote: quantityChangeRequests.milkmanNote,
      createdAt: quantityChangeRequests.createdAt,
      resolvedAt: quantityChangeRequests.resolvedAt,
    })
    .from(quantityChangeRequests)
    .innerJoin(users, eq(users.id, quantityChangeRequests.customerId))
    .leftJoin(deliveries, eq(deliveries.id, quantityChangeRequests.deliveryId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: qcrScope },
        status ? eq(quantityChangeRequests.status, status) : undefined,
      ),
    )
    .orderBy(asc(quantityChangeRequests.deliveryDate))
    .limit(limit)
    .offset(offset);
}

/** A customer's own requests. Uses the customer-side permission. */
export async function listMyQuantityRequests(actor, page = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select()
    .from(quantityChangeRequests)
    .where(
      scoped({ actor, permission: PERMISSIONS.DELIVERY_ADJUST_QUANTITY, columns: qcrScope }),
    )
    .orderBy(desc(quantityChangeRequests.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function findQuantityRequest(actor, id) {
  const [row] = await db
    .select()
    .from(quantityChangeRequests)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: qcrScope },
        eq(quantityChangeRequests.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findPendingForDelivery(txOrDb, actor, deliveryId) {
  const runner = txOrDb ?? db;
  const [row] = await runner
    .select()
    .from(quantityChangeRequests)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_ADJUST_QUANTITY, columns: qcrScope },
        eq(quantityChangeRequests.deliveryId, deliveryId),
        eq(quantityChangeRequests.status, 'PENDING'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updatePendingQuantityRequest(tx, actor, { id, requestedQuantity, customerNote }) {
  const [row] = await tx
    .update(quantityChangeRequests)
    .set({
      requestedQuantity,
      customerNote: customerNote ?? null,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_ADJUST_QUANTITY, columns: qcrScope },
        eq(quantityChangeRequests.id, id),
        eq(quantityChangeRequests.status, 'PENDING'),
      ),
    )
    .returning();
  return row ?? null;
}

export async function cancelPendingQuantityRequestsForDelivery(tx, actor, deliveryId) {
  return tx
    .update(quantityChangeRequests)
    .set({
      status: 'CANCELLED',
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_ADJUST_QUANTITY, columns: qcrScope },
        eq(quantityChangeRequests.deliveryId, deliveryId),
        eq(quantityChangeRequests.status, 'PENDING'),
      ),
    );
}

export async function resolveQuantityRequest(tx, actor, { id, status, milkmanNote }) {
  const [row] = await tx
    .update(quantityChangeRequests)
    .set({
      status,
      milkmanNote: milkmanNote ?? null,
      resolvedBy: actor.userId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: qcrScope },
        eq(quantityChangeRequests.id, id),
        eq(quantityChangeRequests.status, 'PENDING'),
      ),
    )
    .returning();
  return row ?? null;
}

// ── Plan changes ─────────────────────────────────────────────────────────────

export async function createPlanChangeRequest(tx, values) {
  const [row] = await tx.insert(planChangeRequests).values(values).returning();
  return row;
}

export async function listPlanChangeRequests(actor, { status, ...page } = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select({
      id: planChangeRequests.id,
      customerId: planChangeRequests.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      subscriptionRootId: planChangeRequests.subscriptionRootId,
      requestedPlanId: planChangeRequests.requestedPlanId,
      currentPlanName: planChangeRequests.currentPlanName,
      currentQuantity: planChangeRequests.currentQuantity,
      currentUnit: planChangeRequests.currentUnit,
      currentMonthlyPrice: planChangeRequests.currentMonthlyPrice,
      requestedPlanName: planChangeRequests.requestedPlanName,
      requestedQuantity: planChangeRequests.requestedQuantity,
      requestedUnit: planChangeRequests.requestedUnit,
      requestedMonthlyPrice: planChangeRequests.requestedMonthlyPrice,
      requestedSlot: planChangeRequests.requestedSlot,
      status: planChangeRequests.status,
      customerNote: planChangeRequests.customerNote,
      milkmanNote: planChangeRequests.milkmanNote,
      createdAt: planChangeRequests.createdAt,
      resolvedAt: planChangeRequests.resolvedAt,
      planIsActive: milkPlans.isActive,
    })
    .from(planChangeRequests)
    .innerJoin(users, eq(users.id, planChangeRequests.customerId))
    .leftJoin(milkPlans, eq(milkPlans.id, planChangeRequests.requestedPlanId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: pcrScope },
        status ? eq(planChangeRequests.status, status) : undefined,
      ),
    )
    .orderBy(desc(planChangeRequests.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function listMyPlanChangeRequests(actor, page = {}) {
  const { limit, offset } = paginate(page);
  return db
    .select()
    .from(planChangeRequests)
    .where(scoped({ actor, permission: PERMISSIONS.PLAN_CHANGE_REQUEST, columns: pcrScope }))
    .orderBy(desc(planChangeRequests.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function findPlanChangeRequest(actor, id) {
  const [row] = await db
    .select()
    .from(planChangeRequests)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: pcrScope },
        eq(planChangeRequests.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function resolvePlanChangeRequest(tx, actor, { id, status, milkmanNote }) {
  const [row] = await tx
    .update(planChangeRequests)
    .set({
      status,
      milkmanNote: milkmanNote ?? null,
      resolvedBy: actor.userId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: pcrScope },
        eq(planChangeRequests.id, id),
        eq(planChangeRequests.status, 'PENDING'),
      ),
    )
    .returning();
  return row ?? null;
}

/** Badge counts for the milkman's nav, in one round-trip. */
export async function countPendingRequests(actor) {
  const [quantity] = await db
    .select({ count: sql`count(*)::int` })
    .from(quantityChangeRequests)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: qcrScope },
        eq(quantityChangeRequests.status, 'PENDING'),
      ),
    );

  const [plan] = await db
    .select({ count: sql`count(*)::int` })
    .from(planChangeRequests)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.REQUEST_RESOLVE, columns: pcrScope },
        eq(planChangeRequests.status, 'PENDING'),
      ),
    );

  return {
    quantity: quantity?.count ?? 0,
    plan: plan?.count ?? 0,
    total: (quantity?.count ?? 0) + (plan?.count ?? 0),
  };
}
