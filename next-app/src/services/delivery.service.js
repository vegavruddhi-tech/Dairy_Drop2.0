/**
 * Delivery use cases: generation, the round, and status changes.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';

import { db, transaction } from '@/db/index.js';
import { businessDate, addDays, datesBetween, nextMonthStart, monthStart } from '@/domain/dates.js';
import { isDeliveryDay, deliveriesPerDay } from '@/domain/pricing.js';
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
/** One delivery row as a line on a stop. */
function toItem(row) {
  return {
    id: row.id,
    subscriptionRootId: row.subscriptionRootId,
    productName: row.productName,
    unit: row.unit,
    plannedQuantity: row.plannedQuantity,
    adjustedQuantity: row.adjustedQuantity,
    deliveredQuantity: row.deliveredQuantity,
    unitPrice: row.unitPrice,
    amount: row.amount,
    status: row.status,
    skipReason: row.skipReason,
    note: row.note,
    deliveredAt: row.deliveredAt,
  };
}

/**
 * A visit is settled only once every line on it is.
 *
 * A stop showing "delivered" while one of its two bottles is still pending
 * would drop that bottle off the round entirely.
 */
function stopStatus(items) {
  if (items.length === 0) return 'PENDING';
  if (items.some((item) => item.status === 'PENDING')) return 'PENDING';
  if (items.every((item) => item.status === 'DELIVERED')) return 'DELIVERED';
  return items[0].status;
}

/** Morning before evening; a pre-split `BOTH` row sorts with the morning. */
const SLOT_ORDER = { MORNING: 0, BOTH: 0, EVENING: 1 };

/**
 * The concrete slots one subscription produces on a delivery day.
 *
 * `BOTH` is not a slot a delivery can be in — it is a statement that there are
 * two of them. Keeping `BOTH` on a delivery row is what let a two-drop plan
 * masquerade as one.
 */
function slotsFor(slot) {
  if (slot === 'BOTH') return ['MORNING', 'EVENING'];
  return [slot];
}

export async function generateForDate(date = businessDate()) {
  return transaction(async (tx) => {
    const subscriptions = await subscriptionsRepo.listGenerable(tx, date);

    const due = subscriptions.filter((sub) =>
      isDeliveryDay(sub.frequency, sub.effectiveFrom, date),
    );

    /*
     * Days already covered by a legacy `BOTH` row.
     *
     * Before morning and evening were separate rows, a two-slot subscription
     * produced one row carrying the slot `BOTH`. The unique index now includes
     * the slot, so such a row no longer blocks a MORNING/EVENING pair for the
     * same day — and generating them on top would bill that day twice.
     *
     * Those rows are financial records of days that already happened, so they
     * are left alone and the day is treated as done.
     */
    const legacy = await deliveriesRepo.listLegacyBothRoots(tx, date);

    /*
     * One row per *drop*, not per subscription.
     *
     * "Morning & evening" is two deliveries: two rounds, two doors knocked,
     * two lots of milk. It used to produce a single row carrying the slot
     * `BOTH`, so the round had one stop and the bill counted one drop — the
     * customer paid for half of what they received.
     *
     * Each row now carries the concrete slot it belongs to, which is also what
     * lets the unique index keep generation idempotent per slot.
     */
    const rows = due
      .filter((sub) => !legacy.has(sub.rootId))
      .flatMap((sub) =>
      slotsFor(sub.slot).map((slot) => ({
        subscriptionRootId: sub.rootId,
        subscriptionVersionId: sub.versionId,
        customerId: sub.customerId,
        milkmanId: sub.milkmanId,
        deliveryDate: date,
        slot,
        productName: sub.productName,
        unit: sub.unit,
        plannedQuantity: sub.quantity,
        // Frozen at generation time. A delivery is an immutable financial record
        // and carries its own price — the old rows left this null forever and the
        // amount fell back to a hardcoded ₹75.
        unitPrice: sub.unitPrice,
        status: 'PENDING',
      })),
    );

    const created = await deliveriesRepo.insertGenerated(tx, rows);

    return {
      date,
      created: created.length,
      considered: subscriptions.length,
      // Drops due today, which exceeds the subscription count once anyone is
      // on morning & evening.
      due: rows.length,
    };
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

  /*
   * Extras ride along with the *first* stop of the customer's day, not every
   * stop.
   *
   * Once "morning & evening" became two stops, attaching the customer's extras
   * to each of them showed the same 3.5 kg of paneer twice — a milkman reading
   * the round would load it twice and expect to be paid for two. The order is
   * bought once and delivered once, so it belongs to one stop: the earliest,
   * so it arrives as soon as the round reaches them.
   */
  /*
   * A stop is one visit, so group by customer *and* time.
   *
   * A customer may take cow milk and buffalo milk in the same morning: two
   * subscriptions, two delivery rows, but one knock at the door. Rendered as
   * two cards they read as a duplicate — same name, same address, same time —
   * which is exactly the confusion two stops for "morning & evening" caused
   * before they were labelled. One card carrying two lines is what the milkman
   * actually does.
   */
  const grouped = new Map();
  for (const row of [...milkStops].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])) {
    const key = `${row.customerId}:${row.slot}`;
    const stop = grouped.get(key);
    if (stop) {
      stop.items.push(toItem(row));
      continue;
    }
    grouped.set(key, {
      // Identifies the visit, not any one delivery row.
      id: key,
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      addressLine1: row.addressLine1,
      addressArea: row.addressArea,
      addressLandmark: row.addressLandmark,
      deliveryInstructions: row.deliveryInstructions,
      routeSequence: row.routeSequence,
      slot: row.slot,
      morningStart: row.morningStart,
      morningEnd: row.morningEnd,
      eveningStart: row.eveningStart,
      eveningEnd: row.eveningEnd,
      items: [toItem(row)],
    });
  }

  const carried = new Set();
  const stops = [...grouped.values()]
    .map((stop) => {
      const extras = carried.has(stop.customerId)
        ? []
        : (byCustomer.get(stop.customerId) ?? []);
      if (extras.length > 0) carried.add(stop.customerId);
      return { ...stop, extras, status: stopStatus(stop.items) };
    })
    // Back to the order the repository chose: the milkman's route, not the clock.
    .sort(
      (a, b) =>
        (a.routeSequence ?? 9999) - (b.routeSequence ?? 9999) ||
        SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] ||
        String(a.customerName ?? '').localeCompare(String(b.customerName ?? '')),
    );

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
      items: [],
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
      /*
       * Counted in visits, not delivery rows.
       *
       * `roundSummary` counts rows, and one visit can carry two products — so
       * a header saying "4 done" beside a list of 3 cards is the kind of
       * disagreement that makes a milkman recount the bike. Money and litres
       * stay row-based, because those really are per item.
       */
      total: stops.length,
      delivered: stops.filter((stop) => stop.status === 'DELIVERED').length,
      pending: stops.filter((stop) => stop.status === 'PENDING').length,
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
 * Declare a day off / holiday for milkman — every pending stop becomes SKIPPED at ₹0.
 * Supports single day or date range (e.g., Diwali or maintenance).
 */
export async function declareDayOff(actor, { date, startDate, endDate, reason, note }) {
  const from = startDate ?? date ?? businessDate();
  const to = endDate ?? date ?? from;

  return transaction(async (tx) => {
    let affected = [];
    if (from === to) {
      affected = await deliveriesRepo.bulkSkip(tx, actor, {
        date: from,
        reason: reason ?? 'MILKMAN_DAY_OFF',
        note: note ?? 'Dairy holiday / Day off',
      });
    } else {
      affected = await deliveriesRepo.bulkSkipMilkmanRange(tx, actor, {
        startDate: from,
        endDate: to,
        reason: reason ?? 'MILKMAN_DAY_OFF',
        note: note ?? 'Dairy holiday / Day off',
      });
    }

    if (affected.length > 0) {
      const customerIds = [...new Set(affected.map((s) => s.customerId).filter(Boolean))];
      if (customerIds.length > 0) {
        const dateDesc = from === to ? from : `${from} to ${to}`;
        await notificationsRepo.create(
          tx,
          customerIds.map((customerId) => ({
            userId: customerId,
            type: 'DELIVERY',
            title: 'Dairy Holiday / Day Off Notice',
            body: note
              ? `${note} (${dateDesc})`
              : `Your milkman has scheduled a day off for ${dateDesc}. You will not be charged.`,
            href: '/calendar',
          })),
        );
      }
    }

    return { startDate: from, endDate: to, skipped: affected.length };
  });
}

/** Cancel a declared day off / holiday, restoring deliveries back to PENDING. */
export async function cancelDayOff(actor, { date, startDate, endDate }) {
  const from = startDate ?? date ?? businessDate();
  const to = endDate ?? date ?? from;

  return transaction(async (tx) => {
    const restored = await deliveriesRepo.cancelMilkmanDayOff(tx, actor, {
      startDate: from,
      endDate: to,
    });
    return { startDate: from, endDate: to, restored: restored.length };
  });
}

/** Customer multi-day vacation mode: skip all pending deliveries across a date range. */
export async function setVacationRange(actor, { startDate, endDate, note }) {
  if (startDate > endDate) {
    throw new ValidationError('End date cannot be before start date.');
  }
  const today = businessDate();
  if (endDate < today) {
    throw new ValidationError('Vacation dates cannot be in the past.');
  }

  // Pre-generate deliveries for that window if not yet generated
  try {
    const dates = datesBetween(startDate < today ? today : startDate, endDate);
    for (const d of dates.slice(0, 31)) {
      await generateForDate(d);
    }
  } catch (err) {
    // Best effort generation
  }

  return transaction(async (tx) => {
    const affected = await deliveriesRepo.bulkSkipCustomerRange(tx, actor, {
      startDate,
      endDate,
      note: note ?? 'Customer Vacation Mode',
    });

    if (affected.length > 0 && actor.tenantId) {
      await notificationsRepo.create(tx, {
        userId: actor.tenantId,
        type: 'DELIVERY',
        title: 'Customer Vacation / Skip Dates',
        body: `${actor.name} paused deliveries from ${startDate} to ${endDate} (${affected.length} drop(s) skipped)${note ? `: "${note}"` : ''}.`,
        href: `/milkman/round?date=${startDate}`,
      });
    }

    return { startDate, endDate, skipped: affected.length };
  });
}

/** Cancel customer vacation mode: resume skipped deliveries in that window. */
export async function cancelVacation(actor, { startDate, endDate }) {
  return transaction(async (tx) => {
    const restored = await deliveriesRepo.cancelCustomerVacationRange(tx, actor, {
      startDate,
      endDate,
    });
    return { startDate, endDate, restored: restored.length };
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
