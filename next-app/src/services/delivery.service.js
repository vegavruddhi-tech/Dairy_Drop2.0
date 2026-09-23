/**
 * Delivery use cases: generation, the round, and status changes.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';

import { db, transaction } from '@/db/index.js';
import { businessDate, addDays, datesBetween, nextMonthStart, monthStart } from '@/domain/dates.js';
import { isDeliveryDay } from '@/domain/pricing.js';
import { milliToDecimal, toMilli } from '@/domain/money.js';
import { NotFoundError, ValidationError, ConflictError } from '@/domain/errors.js';

import * as deliveriesRepo from '@/repositories/deliveries.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import * as productsRepo from '@/repositories/products.repo.js';

/**
 * Generate delivery rows for a date.
 *
 * Idempotent: the unique index on (subscription_root_id, delivery_date) plus
 * `onConflictDoNothing` means this may run twice, or be re-run for a past date
 * to backfill, without ever creating a second billable row.
 *
 * Honours `frequency` — the previous system stored it, displayed it, and then
 * generated a delivery every day regardless.
 *
 * @param {string} [date] business date; defaults to today
 * @returns {Promise<{ date: string, created: number, considered: number }>}
 */
export async function generateForDate(date = businessDate()) {
  return transaction(async (tx) => {
    const subscriptions = await subscriptionsRepo.listGenerable(tx, date);

    const due = subscriptions.filter((sub) =>
      isDeliveryDay(sub.frequency, sub.effectiveFrom, date),
    );

    const rows = due.map((sub) => ({
      subscriptionRootId: sub.rootId,
      subscriptionVersionId: sub.versionId,
      customerId: sub.customerId,
      milkmanId: sub.milkmanId,
      deliveryDate: date,
      slot: sub.slot,
      productName: sub.productName,
      unit: sub.unit,
      plannedQuantity: sub.quantity,
      // Frozen at generation time. A delivery is an immutable financial record
      // and carries its own price — the old rows left this null forever and the
      // amount fell back to a hardcoded ₹75.
      unitPrice: sub.unitPrice,
      status: 'PENDING',
    }));

    const created = await deliveriesRepo.insertGenerated(tx, rows);

    return { date, created: created.length, considered: subscriptions.length };
  });
}

/** Backfill a range. Used after an outage, or when onboarding historic data. */
export async function generateForRange(from, to) {
  const results = [];
  for (const date of datesBetween(from, to)) {
    results.push(await generateForDate(date));
  }
  return results;
}

/**
 * The milkman's round for a day, with a summary header.
 *
 * Extras ordered for the date are attached to the stop they belong to, so the
 * person loading the bike sees the whole load in one place. A customer who
 * ordered only extras and has no milk that day still gets a stop — otherwise
 * the round would not take the milkman to their door at all.
 */
export async function getRound(actor, date = businessDate()) {
  try {
    await generateForDate(date);
  } catch (err) {
    console.error('Error generating deliveries for round:', err);
  }

  const [milkStops, summary, extras] = await Promise.all([
    deliveriesRepo.listRound(actor, date),
    deliveriesRepo.roundSummary(actor, date),
    productsRepo.listRoundExtras(actor, date),
  ]);

  const byCustomer = new Map();
  for (const extra of extras) {
    const list = byCustomer.get(extra.customerId) ?? [];
    list.push(extra);
    byCustomer.set(extra.customerId, list);
  }

  const stops = milkStops.map((stop) => ({
    ...stop,
    extras: byCustomer.get(stop.customerId) ?? [],
  }));

  /*
   * Extras-only stops.
   *
   * These carry no delivery row, so they have no id to mark and no milk
   * quantity. `milkless` tells the UI to render them as a carry-list rather
   * than as something with delivery buttons; the order itself is marked on the
   * Orders screen, which owns purchase status.
   */
  const visited = new Set(milkStops.map((stop) => stop.customerId));
  for (const [customerId, list] of byCustomer) {
    if (visited.has(customerId)) continue;
    const [first] = list;
    stops.push({
      id: `extras:${customerId}`,
      customerId,
      customerName: first.customerName,
      customerPhone: first.customerPhone,
      addressLine1: first.deliveryAddress ?? null,
      addressArea: null,
      routeSequence: 9999,
      status: 'PENDING',
      milkless: true,
      extras: list,
    });
  }

  const extrasPaise = extras
    .filter((extra) => extra.status !== 'CANCELLED')
    .reduce((total, extra) => total + Math.round(Number(extra.amount ?? 0) * 100), 0);

  return {
    date,
    stops,
    summary: {
      ...summary,
      // The header counted milk stops only, which under-reported the round the
      // moment anyone ordered an extra.
      total: stops.length,
      extrasCount: extras.length,
      extrasPaise,
      milkPaise: Math.round(Number(summary.amount ?? 0) * 100),
      billedPaise: Math.round(Number(summary.amount ?? 0) * 100) + extrasPaise,
    },
  };
}

/** A customer's own view of a day, across every plan they hold. */
export async function getCustomerDay(actor, date = businessDate()) {
  try {
    await generateForDate(date);
  } catch (err) {
    console.error('Error generating deliveries for customer day:', err);
  }
  const rows = await deliveriesRepo.listCustomerDay(actor, date);
  return { date, deliveries: rows };
}

/**
 * Mark one stop.
 *
 * `DELIVERED` requires a quantity; everything else clears it. The database
 * enforces the same rule with a CHECK constraint, so an inconsistent row cannot
 * be written even by a future code path that forgets.
 */
export async function markDelivery(actor, { deliveryId, status, quantity, note, skipReason }) {
  const existing = await deliveriesRepo.findById(actor, deliveryId);
  if (!existing) throw new NotFoundError('That delivery');

  if (existing.status === 'CANCELLED') {
    throw new ConflictError('That delivery was cancelled and can no longer be marked.');
  }

  const patch = { markedBy: actor.userId, note: note ?? existing.note };

  switch (status) {
    case 'DELIVERED': {
      // Default to what was planned for the day, including any one-day adjustment.
      const delivered = quantity ?? existing.adjustedQuantity ?? existing.plannedQuantity;
      if (toMilli(delivered) <= 0) {
        throw new ValidationError('Enter how much was delivered.');
      }
      patch.status = 'DELIVERED';
      patch.deliveredQuantity = delivered;
      patch.deliveredAt = new Date();
      patch.skipReason = null;
      break;
    }

    case 'SKIPPED':
    case 'UNDELIVERED':
      patch.status = status;
      patch.deliveredQuantity = null;
      patch.deliveredAt = null;
      patch.skipReason = skipReason ?? (status === 'SKIPPED' ? 'OTHER' : 'CUSTOMER_ABSENT');
      break;

    case 'PENDING':
      patch.status = 'PENDING';
      patch.deliveredQuantity = null;
      patch.deliveredAt = null;
      patch.skipReason = null;
      break;

    default:
      throw new ValidationError(`Unknown delivery status: ${status}`);
  }

  return transaction(async (tx) => {
    const updated = await deliveriesRepo.updateStatus(tx, actor, { id: deliveryId, patch });
    if (!updated) throw new NotFoundError('That delivery');

    if (status === 'DELIVERED') {
      await notificationsRepo.create(tx, {
        userId: updated.customerId,
        type: 'DELIVERY',
        title: 'Delivered',
        body: `${updated.productName} · ${Number(updated.deliveredQuantity)} ${updated.unit} delivered today.`,
        href: '/calendar',
        subjectType: 'delivery',
        subjectId: updated.id,
      });
    }

    return updated;
  });
}

/**
 * Declare a day off — every pending stop becomes SKIPPED at ₹0.
 *
 * Only PENDING rows are touched, so a stop already delivered earlier in the
 * round is not retroactively unbilled.
 */
export async function declareDayOff(actor, { date, reason, note }) {
  return transaction(async (tx) => {
    const affected = await deliveriesRepo.bulkSkip(tx, actor, {
      date,
      reason: reason ?? 'MILKMAN_DAY_OFF',
      note: note ?? 'No delivery today',
    });

    if (affected.length > 0) {
      const stops = await deliveriesRepo.listRound(actor, date);
      const customerIds = [...new Set(stops.map((s) => s.customerId))];

      await notificationsRepo.create(
        tx,
        customerIds.map((customerId) => ({
          userId: customerId,
          type: 'DELIVERY',
          title: 'No delivery today',
          body: note ?? 'Your milkman has marked today as a day off. You will not be charged.',
          href: '/calendar',
        })),
      );
    }

    return { date, skipped: affected.length };
  });
}

/**
 * Change the quantity for one day.
 *
 * Writes `adjustedQuantity` on that single delivery and **nothing else**. The
 * previous system's equivalent permanently rewrote the subscription's standard
 * quantity, across every plan the customer held.
 */
export async function adjustQuantity(actor, { deliveryId, quantity, note }) {
  const delivery = await deliveriesRepo.findById(actor, deliveryId);
  if (!delivery) throw new NotFoundError('That delivery');

  if (delivery.status !== 'PENDING') {
    throw new ConflictError(
      delivery.status === 'DELIVERED'
        ? 'That delivery has already been made.'
        : 'That delivery can no longer be changed.',
    );
  }

  const milli = toMilli(quantity);
  if (milli <= 0) throw new ValidationError('Enter a quantity greater than zero.');
  if (milli > 100_000) throw new ValidationError('That quantity is too large.');

  const plannedMilli = toMilli(delivery.plannedQuantity);
  const currentMilli = toMilli(delivery.adjustedQuantity ?? delivery.plannedQuantity);

  /*
   * Confirming the dialog without moving the stepper is not a change.
   *
   * It used to write `adjusted_quantity = planned_quantity`, which put a
   * "changed today" badge on the milkman's round and sent them a notification
   * saying the customer had set the amount they were always getting. The
   * milkman then went looking for a difference that was not there.
   *
   * Setting it back to the plan is the opposite of an adjustment, so it clears
   * the field rather than storing a redundant copy of the planned amount.
   */
  if (milli === currentMilli && note == null) return delivery;

  const isBackToPlan = milli === plannedMilli;

  return transaction(async (tx) => {
    const updated = await deliveriesRepo.setAdjustedQuantity(tx, actor, {
      id: deliveryId,
      quantity: isBackToPlan ? null : milliToDecimal(milli),
      note,
    });
    if (!updated) throw new NotFoundError('That delivery');

    await notificationsRepo.create(tx, {
      userId: updated.milkmanId,
      type: 'QUANTITY_CHANGE',
      title: isBackToPlan ? 'Back to the usual amount' : 'Quantity changed for one day',
      body: isBackToPlan
        ? `${actor.name} is back to ${Number(updated.plannedQuantity)} ${updated.unit} for ${updated.deliveryDate}.`
        : `${actor.name} set ${Number(updated.adjustedQuantity)} ${updated.unit} for ${updated.deliveryDate} (usually ${Number(updated.plannedQuantity)}).`,
      href: `/milkman/round?date=${updated.deliveryDate}`,
      subjectType: 'delivery',
      subjectId: updated.id,
    });

    return updated;
  });
}

/** Skip a single day at the customer's request. */
export async function skipDay(actor, { deliveryId, note }) {
  const delivery = await deliveriesRepo.findById(actor, deliveryId);
  if (!delivery) throw new NotFoundError('That delivery');
  if (delivery.status !== 'PENDING') {
    throw new ConflictError('That delivery can no longer be changed.');
  }

  return transaction(async (tx) => {
    const updated = await deliveriesRepo.updateStatus(tx, actor, {
      id: deliveryId,
      patch: {
        status: 'SKIPPED',
        skipReason: 'CUSTOMER_REQUEST',
        note: note ?? null,
        deliveredQuantity: null,
        deliveredAt: null,
      },
    });
    if (!updated) throw new NotFoundError('That delivery');

    await notificationsRepo.create(tx, {
      userId: updated.milkmanId,
      type: 'DELIVERY',
      title: 'Customer skipped a day',
      body: `${actor.name} skipped ${updated.deliveryDate}${note ? ` — ${note}` : ''}.`,
      href: `/milkman/round?date=${updated.deliveryDate}`,
      subjectType: 'delivery',
      subjectId: updated.id,
    });

    return updated;
  });
}

/** Undo a customer skip while the day is still ahead. */
export async function resumeDay(actor, { deliveryId }) {
  const delivery = await deliveriesRepo.findById(actor, deliveryId);
  if (!delivery) throw new NotFoundError('That delivery');
  if (delivery.status !== 'SKIPPED') {
    throw new ConflictError('That day is not skipped.');
  }
  if (delivery.deliveryDate < businessDate()) {
    throw new ConflictError('That day has already passed.');
  }

  return transaction(async (tx) =>
    deliveriesRepo.updateStatus(tx, actor, {
      id: deliveryId,
      patch: { status: 'PENDING', skipReason: null, note: null },
    }),
  );
}

/** A customer's month, for the calendar screen. */
export async function getMonth(actor, { customerId, month }) {
  return deliveriesRepo.listForMonth(actor, {
    customerId: customerId ?? actor.userId,
    month,
  });
}
