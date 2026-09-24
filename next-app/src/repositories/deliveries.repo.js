/**
 * Delivery data access — the round, the month, and the generator.
 *
 * Every read goes through `scoped()`, so a milkman can only ever see their own
 * round and a customer only their own deliveries. There is no unscoped query in
 * this file.
 */

import 'server-only';
import { and, eq, ne, gte, lte, lt, inArray, asc, sql, isNotNull } from 'drizzle-orm';

import { db } from '@/db/index.js';
import { deliveries, milkSubscriptions, milkPlans, users, addresses, serviceAreas } from '@/db/schema/index.js';
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
        // A withdrawn delivery is not happening, so it is not part of the day.
        // It stays in the table as the record of a day that was scheduled and
        // then called off; billing ignores it because it is not DELIVERED.
        ne(deliveries.status, 'CANCELLED'),
        /*
         * Nor a delivery whose subscription no longer exists.
         *
         * The FK is `onDelete: 'set null'`, so a subscription removed outright
         * leaves its deliveries behind with this column nulled — and when
         * plans and subscriptions were deleted, their pending days stayed and
         * the customer kept seeing milk that was never going to come. Checked
         * on the column rather than via the subscription join, so the round
         * header's aggregate (which has no join) excludes them too and keeps
         * agreeing with the list beneath it. A superseded version still exists,
         * so a day on old terms is unaffected.
         */
        isNotNull(deliveries.subscriptionVersionId),
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
        ne(deliveries.status, 'CANCELLED'),
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
        ne(deliveries.status, 'CANCELLED'),
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
      /*
       * Why this delivery may not come again.
       *
       * `termsEndOn` is set once the version behind it has been superseded or
       * cancelled — the day is still owed, but these terms stop afterwards.
       * `planRetired` means the milkman has withdrawn the plan from their
       * catalog, which changes nothing for this customer but explains why they
       * can no longer switch to it.
       */
      termsEndOn: milkSubscriptions.effectiveTo,
      planRetired: sql`coalesce(${milkPlans.isActive}, true) = false`.as('plan_retired'),
    })
    .from(deliveries)
    .leftJoin(
      milkSubscriptions,
      eq(milkSubscriptions.id, deliveries.subscriptionVersionId),
    )
    .leftJoin(milkPlans, eq(milkPlans.id, milkSubscriptions.planId))
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_READ, columns: scopeColumns },
        eq(deliveries.deliveryDate, date),
        // A withdrawn delivery is not happening, so it is not part of the day.
        // It stays in the table as the record of a day that was scheduled and
        // then called off; billing ignores it because it is not DELIVERED.
        ne(deliveries.status, 'CANCELLED'),
        /*
         * Nor a delivery whose subscription no longer exists.
         *
         * The FK is `onDelete: 'set null'`, so a subscription removed outright
         * leaves its deliveries behind with this column nulled — and when
         * plans and subscriptions were deleted, their pending days stayed and
         * the customer kept seeing milk that was never going to come. Checked
         * on the column rather than via the subscription join, so the round
         * header's aggregate (which has no join) excludes them too and keeps
         * agreeing with the list beneath it. A superseded version still exists,
         * so a day on old terms is unaffected.
         */
        isNotNull(deliveries.subscriptionVersionId),
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
        // Same exclusion as `listRound`, or the header counts stops the list
        // below it does not show.
        ne(deliveries.status, 'CANCELLED'),
        /*
         * Nor a delivery whose subscription no longer exists.
         *
         * The FK is `onDelete: 'set null'`, so a subscription removed outright
         * leaves its deliveries behind with this column nulled — and when
         * plans and subscriptions were deleted, their pending days stayed and
         * the customer kept seeing milk that was never going to come. Checked
         * on the column rather than via the subscription join, so the round
         * header's aggregate (which has no join) excludes them too and keeps
         * agreeing with the list beneath it. A superseded version still exists,
         * so a day on old terms is unaffected.
         */
        isNotNull(deliveries.subscriptionVersionId),
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
/**
 * Subscription roots that already hold a pre-split `BOTH` row for a date.
 *
 * "Morning & evening" used to be one row carrying the slot `BOTH`. Those rows
 * are history — some are delivered and billed — so generation treats the day as
 * already covered rather than adding a morning and an evening beside them.
 */
export async function listLegacyBothRoots(tx, date) {
  const rows = await tx
    .select({ rootId: deliveries.subscriptionRootId })
    .from(deliveries)
    .where(and(eq(deliveries.deliveryDate, date), eq(deliveries.slot, 'BOTH')));
  return new Set(rows.map((row) => row.rootId));
}

/**
 * Point an undelivered day at new terms, in place.
 *
 * A plan change that lands today cannot cancel the day and insert a fresh row:
 * the unique index covers (root, date, slot) and the cancelled row still holds
 * that key, so the insert is silently skipped and the customer's day goes
 * blank. Nothing has been delivered under it, so there is no history to protect
 * and editing it is honest.
 *
 * Restricted to PENDING, so a day already delivered is never rewritten.
 */
export async function retargetPending(tx, { subscriptionRootId, date, slot, patch }) {
  const [row] = await tx
    .update(deliveries)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(deliveries.subscriptionRootId, subscriptionRootId),
        eq(deliveries.deliveryDate, date),
        eq(deliveries.slot, slot),
        eq(deliveries.status, 'PENDING'),
      ),
    )
    .returning({ id: deliveries.id });
  return row ?? null;
}

export async function insertGenerated(tx, rows) {
  if (rows.length === 0) return [];
  return tx
    .insert(deliveries)
    .values(rows)
    // Must name the same columns as the unique index, which includes the slot:
    // "morning & evening" is two rows for one day, and they must not collide.
    .onConflictDoNothing({
      target: [deliveries.subscriptionRootId, deliveries.deliveryDate, deliveries.slot],
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
    .returning({ id: deliveries.id, customerId: deliveries.customerId });
}

/** Bulk day off across a date range for a milkman. */
export async function bulkSkipMilkmanRange(tx, actor, { startDate, endDate, reason, note }) {
  return tx
    .update(deliveries)
    .set({
      status: 'SKIPPED',
      skipReason: reason ?? 'MILKMAN_DAY_OFF',
      note: note ?? 'Dairy holiday / Day off',
      deliveredQuantity: null,
      deliveredAt: null,
      markedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_BULK_DAY_OFF, columns: scopeColumns },
        and(
          gte(deliveries.deliveryDate, startDate),
          lte(deliveries.deliveryDate, endDate),
          eq(deliveries.status, 'PENDING'),
        ),
      ),
    )
    .returning({ id: deliveries.id, customerId: deliveries.customerId, deliveryDate: deliveries.deliveryDate });
}

/** Cancel a declared day off / holiday, restoring SKIPPED deliveries back to PENDING. */
export async function cancelMilkmanDayOff(tx, actor, { startDate, endDate }) {
  return tx
    .update(deliveries)
    .set({
      status: 'PENDING',
      skipReason: null,
      note: null,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_BULK_DAY_OFF, columns: scopeColumns },
        and(
          gte(deliveries.deliveryDate, startDate),
          lte(deliveries.deliveryDate, endDate),
          eq(deliveries.status, 'SKIPPED'),
          eq(deliveries.skipReason, 'MILKMAN_DAY_OFF'),
        ),
      ),
    )
    .returning({ id: deliveries.id, customerId: deliveries.customerId, deliveryDate: deliveries.deliveryDate });
}

/** Customer multi-day vacation mode: skip all pending deliveries in range. */
export async function bulkSkipCustomerRange(tx, actor, { startDate, endDate, note }) {
  return tx
    .update(deliveries)
    .set({
      status: 'SKIPPED',
      skipReason: 'CUSTOMER_REQUEST',
      note: note ?? 'Customer Vacation Mode',
      deliveredQuantity: null,
      deliveredAt: null,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_SKIP, columns: scopeColumns },
        and(
          gte(deliveries.deliveryDate, startDate),
          lte(deliveries.deliveryDate, endDate),
          eq(deliveries.status, 'PENDING'),
        ),
      ),
    )
    .returning({ id: deliveries.id, milkmanId: deliveries.milkmanId, deliveryDate: deliveries.deliveryDate });
}

/** Cancel customer vacation mode: restore SKIPPED deliveries in range back to PENDING. */
export async function cancelCustomerVacationRange(tx, actor, { startDate, endDate }) {
  return tx
    .update(deliveries)
    .set({
      status: 'PENDING',
      skipReason: null,
      note: null,
      updatedAt: new Date(),
    })
    .where(
      scoped(
        { actor, permission: PERMISSIONS.DELIVERY_SKIP, columns: scopeColumns },
        and(
          gte(deliveries.deliveryDate, startDate),
          lte(deliveries.deliveryDate, endDate),
          eq(deliveries.status, 'SKIPPED'),
          eq(deliveries.skipReason, 'CUSTOMER_REQUEST'),
        ),
      ),
    )
    .returning({ id: deliveries.id, milkmanId: deliveries.milkmanId, deliveryDate: deliveries.deliveryDate });
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
