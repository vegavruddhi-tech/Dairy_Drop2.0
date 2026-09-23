/**
 * Delivery data access — the round, the month, and the generator.
 *
 * Every read goes through `scoped()`, so a milkman can only ever see their own
 * round and a customer only their own deliveries. There is no unscoped query in
 * this file.
 */

import 'server-only';
import { and, eq, gte, lt, inArray, asc, sql } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { deliveries, milkSubscriptions, users, addresses, serviceAreas } from '@/db/schema/index.js';
import { PERMISSIONS } from '@/auth/roles.js';
import { scoped } from './base.js';
import { monthStart, nextMonthStart } from '@/domain/dates.js';

const scopeColumns = { tenant: deliveries.milkmanId, owner: deliveries.customerId };

/**
 * The milkman's round for one day, ordered the way it is walked.
 *
 * Unlike the previous implementation this reads real rows only — no synthetic
 * `temp-` ids. The generator guarantees the rows exist; if one is missing the
 * fix is to run the generator, not to invent a row at read time.
 */
export async function listRound(actor, date) {
  return db
    .select({
      id: deliveries.id,
      subscriptionRootId: deliveries.subscriptionRootId,
      customerId: deliveries.customerId,
      customerName: users.name,
      customerPhone: users.phone,
      addressLine1: addresses.line1,
      addressArea: addresses.area,
      addressLandmark: addresses.landmark,
      deliveryInstructions: addresses.deliveryInstructions,
      routeSequence: sql`coalesce(${serviceAreas.routeSequence}, 9999)`.as('route_sequence'),
      productName: deliveries.productName,
      unit: deliveries.unit,
      plannedQuantity: deliveries.plannedQuantity,
      adjustedQuantity: deliveries.adjustedQuantity,
      deliveredQuantity: deliveries.deliveredQuantity,
      unitPrice: deliveries.unitPrice,
      amount: deliveries.amount,
      slot: deliveries.slot,
      status: deliveries.status,
      skipReason: deliveries.skipReason,
      note: deliveries.note,
      deliveredAt: deliveries.deliveredAt,
      /*
       * The promised window, read from the subscription version this delivery
       * was generated from rather than copied onto every delivery row. The
       * subscription already snapshots it at enrolment, so it cannot drift;
       * duplicating it per day would be a second copy to keep in step.
       */
      morningStart: milkSubscriptions.morningStart,
      morningEnd: milkSubscriptions.morningEnd,
      eveningStart: milkSubscriptions.eveningStart,
      eveningEnd: milkSubscriptions.eveningEnd,
    })
    .from(deliveries)
    .innerJoin(users, eq(users.id, deliveries.customerId))
    .leftJoin(
      milkSubscriptions,
      eq(milkSubscriptions.id, deliveries.subscriptionVersionId),
    )
    .leftJoin(
      addresses,
      and(eq(addresses.userId, deliveries.customerId), eq(addresses.isDefault, true)),
    )
    .leftJoin(
      serviceAreas,
      and(
        eq(serviceAreas.milkmanId, deliveries.milkmanId),
        eq(serviceAreas.areaName, addresses.area),
      ),
    )
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        eq(deliveries.deliveryDate, date),
      ),
    )
    .orderBy(asc(sql`route_sequence`), asc(users.name));
}

/** One customer's deliveries for a month. The billing input. */
export async function listForMonth(actor, { customerId, month }) {
  return db
    .select({
      id: deliveries.id,
      subscriptionRootId: deliveries.subscriptionRootId,
      deliveryDate: deliveries.deliveryDate,
      status: deliveries.status,
      skipReason: deliveries.skipReason,
      productName: deliveries.productName,
      unit: deliveries.unit,
      plannedQuantity: deliveries.plannedQuantity,
      adjustedQuantity: deliveries.adjustedQuantity,
      deliveredQuantity: deliveries.deliveredQuantity,
      unitPrice: deliveries.unitPrice,
      amount: deliveries.amount,
      slot: deliveries.slot,
      note: deliveries.note,
      deliveredAt: deliveries.deliveredAt,
    })
    .from(deliveries)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        eq(deliveries.customerId, customerId),
        // Half-open range. A closed `<= month-31` against a date column silently
        // dropped the last day in the previous system.
        gte(deliveries.deliveryDate, monthStart(month)),
        lt(deliveries.deliveryDate, nextMonthStart(month)),
      ),
    )
    .orderBy(asc(deliveries.deliveryDate));
}

/** Every delivery for a milkman in a month — the earnings input. */
export async function listTenantMonth(actor, month) {
  return db
    .select({
      id: deliveries.id,
      customerId: deliveries.customerId,
      subscriptionRootId: deliveries.subscriptionRootId,
      deliveryDate: deliveries.deliveryDate,
      status: deliveries.status,
      productName: deliveries.productName,
      unit: deliveries.unit,
      plannedQuantity: deliveries.plannedQuantity,
      adjustedQuantity: deliveries.adjustedQuantity,
      deliveredQuantity: deliveries.deliveredQuantity,
      unitPrice: deliveries.unitPrice,
      amount: deliveries.amount,
    })
    .from(deliveries)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        gte(deliveries.deliveryDate, monthStart(month)),
        lt(deliveries.deliveryDate, nextMonthStart(month)),
      ),
    );
}

/** A customer's own view of today, across every plan they hold. */
export async function listCustomerDay(actor, date) {
  return db
    .select({
      id: deliveries.id,
      subscriptionRootId: deliveries.subscriptionRootId,
      productName: deliveries.productName,
      unit: deliveries.unit,
      plannedQuantity: deliveries.plannedQuantity,
      adjustedQuantity: deliveries.adjustedQuantity,
      deliveredQuantity: deliveries.deliveredQuantity,
      unitPrice: deliveries.unitPrice,
      slot: deliveries.slot,
      status: deliveries.status,
      skipReason: deliveries.skipReason,
      note: deliveries.note,
      deliveredAt: deliveries.deliveredAt,
      /*
       * The promised window, read from the subscription version this delivery
       * was generated from rather than copied onto every delivery row. The
       * subscription already snapshots it at enrolment, so it cannot drift;
       * duplicating it per day would be a second copy to keep in step.
       */
      morningStart: milkSubscriptions.morningStart,
      morningEnd: milkSubscriptions.morningEnd,
      eveningStart: milkSubscriptions.eveningStart,
      eveningEnd: milkSubscriptions.eveningEnd,
    })
    .from(deliveries)
    .leftJoin(
      milkSubscriptions,
      eq(milkSubscriptions.id, deliveries.subscriptionVersionId),
    )
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        eq(deliveries.deliveryDate, date),
      ),
    )
    .orderBy(asc(deliveries.slot));
}

/** Read one delivery within scope. Returns null when outside it. */
export async function findById(actor, id) {
  const [row] = await db
    .select()
    .from(deliveries)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        eq(deliveries.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Aggregate counts for the round header, in SQL rather than in JavaScript. */
export async function roundSummary(actor, date) {
  const [row] = await db
    .select({
      total: sql`count(*)::int`,
      pending: sql`count(*) filter (where ${deliveries.status} = 'PENDING')::int`,
      delivered: sql`count(*) filter (where ${deliveries.status} = 'DELIVERED')::int`,
      skipped: sql`count(*) filter (where ${deliveries.status} = 'SKIPPED')::int`,
      undelivered: sql`count(*) filter (where ${deliveries.status} = 'UNDELIVERED')::int`,
      litres: sql`coalesce(sum(${deliveries.deliveredQuantity}) filter (where ${deliveries.status} = 'DELIVERED'), 0)`,
      amount: sql`coalesce(sum(${deliveries.amount}), 0)`,
    })
    .from(deliveries)
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        eq(deliveries.deliveryDate, date),
      ),
    );
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert generated deliveries, skipping any that already exist.
 *
 * `onConflictDoNothing` against the (subscription_root_id, delivery_date) unique
 * index is what makes generation idempotent — it can run twice, or be backfilled
 * for a past date, without ever creating a second billable row.
 *
 * @param {object} tx  a transaction, or the db handle
 */
export async function insertGenerated(tx, rows) {
  if (rows.length === 0) return [];
  return tx
    .insert(deliveries)
    .values(rows)
    .onConflictDoNothing({
      target: [deliveries.subscriptionRootId, deliveries.deliveryDate],
    })
    .returning({ id: deliveries.id });
}

/**
 * Apply a status to one delivery, scoped.
 *
 * The scope predicate lives in the WHERE clause, so an out-of-scope id affects
 * zero rows and is reported as "not found" — never confirming that another
 * tenant's record exists.
 */
export async function updateStatus(tx, actor, { id, patch }) {
  const [row] = await tx
    .update(deliveries)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_MARK, columns: scopeColumns },
        eq(deliveries.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

/** Set a one-day quantity adjustment. Never touches the subscription. */
export async function setAdjustedQuantity(tx, actor, { id, quantity, note }) {
  const [row] = await tx
    .update(deliveries)
    .set({ adjustedQuantity: quantity, note: note ?? null, updatedAt: new Date() })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_ADJUST_QUANTITY, columns: scopeColumns },
        eq(deliveries.id, id),
        // Cannot change what has already been handed over.
        eq(deliveries.status, 'PENDING'),
      ),
    )
    .returning();
  return row ?? null;
}

/** Bulk day off: every pending stop for a date becomes SKIPPED at ₹0. */
export async function bulkSkip(tx, actor, { date, reason, note }) {
  return tx
    .update(deliveries)
    .set({
      status: 'SKIPPED',
      skipReason: reason,
      note: note ?? null,
      deliveredQuantity: null,
      deliveredAt: null,
      markedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_BULK_DAY_OFF, columns: scopeColumns },
        eq(deliveries.deliveryDate, date),
        eq(deliveries.status, 'PENDING'),
      ),
    )
    .returning({ id: deliveries.id });
}

/** Withdraw future scheduled deliveries when a subscription ends. */
export async function cancelFrom(tx, { subscriptionRootId, fromDate }) {
  return tx
    .update(deliveries)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(
      and(
        eq(deliveries.subscriptionRootId, subscriptionRootId),
        gte(deliveries.deliveryDate, fromDate),
        eq(deliveries.status, 'PENDING'),
      ),
    )
    .returning({ id: deliveries.id });
}

/** Dates in a range that already have a row — used by the generator to skip work. */
export async function existingDates(tx, { subscriptionRootIds, from, to }) {
  if (subscriptionRootIds.length === 0) return new Set();
  const rows = await tx
    .select({
      subscriptionRootId: deliveries.subscriptionRootId,
      deliveryDate: deliveries.deliveryDate,
    })
    .from(deliveries)
    .where(
      and(
        inArray(deliveries.subscriptionRootId, subscriptionRootIds),
        gte(deliveries.deliveryDate, from),
        lt(deliveries.deliveryDate, to),
      ),
    );
  return new Set(rows.map((r) => `${r.subscriptionRootId}|${r.deliveryDate}`));
}
