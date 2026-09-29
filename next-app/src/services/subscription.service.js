/**
 * Customer subscription use cases, including the versioned plan change.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import { milkSubscriptions, users } from '@/db/schema/index.js';
import { businessDate, businessMonth, addDays, monthEnd, monthOf } from '@/domain/dates.js';
import {
  resolveUnitPrice,
  quotedMonthlyPaise,
  clashingSlots,
  slotLabel,
  slotsStillAheadToday,
  quoteForQuantity,
} from '@/domain/pricing.js';
import { paiseToDecimal, formatPaise } from '@/domain/money.js';
import { NotFoundError, ConflictError, ValidationError } from '@/domain/errors.js';

import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import * as deliveriesRepo from '@/repositories/deliveries.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import * as requestsRepo from '@/repositories/requests.repo.js';
import { assertCanAcceptCustomer } from './onboarding.service.js';

/** Plans the customer may choose from — their own milkman's catalog. */
export async function listAvailablePlans(actor) {
  const plans = await subscriptionsRepo.listPlansForCustomer(actor);
  const month = businessMonth();

  return plans.map((plan) => ({
    ...plan,
    quotedMonthlyPaise: quotedMonthlyPaise(plan, month),
    unitPrice: resolveUnitPrice(plan, month).unitPrice,
  }));
}

/** The customer's current subscriptions. */
export async function listMine(actor) {
  return subscriptionsRepo.listCurrentForCustomer(actor, actor.userId);
}

/**
 * Subscribe to a plan.
 *
 * A customer may hold several subscriptions at once — the bill sums all of them.
 * Each one is its own `rootId`.
 */
/** Subscriptions that still hold their delivery times. */
function holdsASlot(subscription) {
  // A paused plan keeps its slot — it is coming back, and freeing the slot
  // would let something else take it with no way to resume. A request still
  // waiting for the milkman holds it too, or the same order could be asked
  // for twice before either is answered.
  return ['PENDING', 'ACTIVE', 'PAUSED'].includes(subscription.status);
}

/**
 * Refuse the same product at a time the customer already receives it.
 *
 * A stop is one visit, not one item: cow milk and buffalo milk can arrive
 * together at 6am, and that is a normal order. What cannot happen is the same
 * product twice at the same time — not two orders, one order written twice.
 *
 * A unique index enforces the same rule, because two simultaneous requests can
 * both pass a check like this one. This exists to say *which* plan is in the
 * way, which a constraint violation cannot.
 *
 * @param {object[]} existing  the customer's current subscription versions
 * @param {string} wanted      the slot being taken
 */
function assertSlotIsFree(existing, wanted) {
  const held = existing.filter(holdsASlot);
  const clashes = clashingSlots(held, wanted);
  if (clashes.length === 0) return;

  const blocker = held.find((s) => clashingSlots([s], wanted).length > 0);
  const times = clashes.map(slotLabel).join(' and ');

  throw new ConflictError(
    `You already get ${wanted.productName} in the ${times}. ` +
      'Change that plan or cancel it before ordering the same thing again.',
    { clashes, blockingRootId: blocker?.rootId ?? null },
  );
}

/**
 * The delivery windows a subscription inherits, for the slot it actually runs.
 *
 * A customer on the morning half of a "both" plan is promised the morning
 * window and nothing else — carrying the evening one would render a time they
 * never receive milk at.
 */
function windowsFor(plan, slot) {
  const morning = slot === 'MORNING' || slot === 'BOTH';
  const evening = slot === 'EVENING' || slot === 'BOTH';
  return {
    morningStart: morning ? plan.morningStart ?? null : null,
    morningEnd: morning ? plan.morningEnd ?? null : null,
    eveningStart: evening ? plan.eveningStart ?? null : null,
    eveningEnd: evening ? plan.eveningEnd ?? null : null,
  };
}

export async function subscribe(actor, { planId, startDate, slot, quantity }) {
  const plan = await subscriptionsRepo.findPlan(actor, planId);
  if (!plan || !plan.isActive) throw new NotFoundError('That plan');

  const effectiveFrom = startDate ?? businessDate();
  const month = effectiveFrom.slice(0, 7);

  /*
   * Price for the slot *and the quantity* this customer takes.
   *
   * A plan is a rate card — a price per litre and a shift — and the customer
   * decides how much. A customer may also take only the morning half of a
   * "morning & evening" plan; quoting the plan's own slot would have promised
   * two drops a day while they receive one.
   */
  const chosenSlot = slot ?? plan.slot;
  const chosenQuantity = String(quantity ?? plan.quantity);
  const quote = quoteForQuantity(plan, { quantity: chosenQuantity, slot: chosenSlot }, month);

  const existing = await subscriptionsRepo.listCurrentForCustomer(actor, actor.userId);
  if (existing.some((s) => s.planId === plan.id && (s.status === 'ACTIVE' || s.status === 'PENDING'))) {
    throw new ConflictError('You already have that plan, or a request for it is waiting.');
  }

  const runningCount = existing.filter(holdsASlot).length;
  if (runningCount >= 2) {
    throw new ValidationError('You can have a maximum of 2 active milk plans at a time. Please cancel or change an existing plan first.');
  }

  assertSlotIsFree(existing, { slot: chosenSlot, productName: plan.productName });

  /*
   * Every new subscription is a request until the milkman approves it.
   *
   * PENDING generates no deliveries and bills nothing; it holds its slot so the
   * same thing cannot be asked for twice. Approval — `decideSubscription`, or
   * approving the customer themselves — makes it ACTIVE from the next round
   * the cut-off still allows.
   */
  return transaction(async (tx) => {
    const rootId = randomUUID();

    const subscription = await subscriptionsRepo.insertSubscription(tx, {
      id: rootId,
      rootId,
      customerId: actor.userId,
      milkmanId: actor.tenantId,
      planId: plan.id,
      productName: plan.productName,
      quantity: chosenQuantity,
      unit: plan.unit,
      frequency: plan.frequency,
      slot: chosenSlot,
      // Snapshotted with the rest of the agreed terms: editing the plan later
      // must not silently move the time this customer was promised.
      ...windowsFor(plan, chosenSlot),
      unitPrice: quote.unitPrice,
      quotedMonthlyPrice: paiseToDecimal(quote.monthlyPaise),
      status: 'PENDING',
      effectiveFrom,
    });

    await notificationsRepo.create(tx, {
      userId: actor.tenantId,
      type: 'SUBSCRIPTION',
      title: 'New subscription request',
      body: `${actor.name} wants ${plan.name}: ${Number(chosenQuantity)} ${plan.unit} ${slotLabel(chosenSlot).toLowerCase()}, about ${formatPaise(quote.monthlyPaise, { whole: true })} a month.`,
      href: '/milkman/requests',
      subjectType: 'milk_subscription',
      subjectId: subscription.id,
    });

    return { ...subscription, requiresApproval: true };
  });
}

/**
 * The day an approved request starts: today if that round has not set off,
 * otherwise tomorrow — the same rule a plan change follows. Never earlier than
 * the date the customer asked for.
 */
export function approvalStartDate(subscription, today = businessDate()) {
  const asked = subscription.effectiveFrom > today ? subscription.effectiveFrom : today;
  if (asked > today) return asked;
  return slotsStillAheadToday(subscription).length > 0 ? today : addDays(today, 1);
}

/**
 * The milkman approves or declines a customer's subscription request.
 *
 * Approving opens it from `approvalStartDate` and builds its deliveries;
 * declining closes it and frees its slot. The customer is told either way.
 */
export async function decideSubscription(actor, { rootId, approve, note }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That request');
  if (current.status !== 'PENDING') throw new ConflictError('That request has already been answered.');

  // A brand-new customer's first plan is approved by approving the customer —
  // one yes for both. Approving only the plan would open it for an account
  // that still cannot receive deliveries.
  if (approve) {
    const [owner] = await db
      .select({ approvalStatus: users.approvalStatus })
      .from(users)
      .where(eq(users.id, current.customerId))
      .limit(1);
    if (owner?.approvalStatus && owner.approvalStatus !== 'APPROVED') {
      throw new ConflictError(
        'This is a new customer. Approve them under Customers → Waiting; that approves this plan too.',
      );
    }
  }

  const startsOn = approvalStartDate(current);

  const decided = await transaction(async (tx) => {
    const row = approve
      ? await subscriptionsRepo.activatePending(tx, { id: current.id, effectiveFrom: startsOn })
      : await subscriptionsRepo.declinePending(tx, { id: current.id });
    if (!row) throw new ConflictError('That request has already been answered.');

    await notificationsRepo.create(tx, {
      userId: current.customerId,
      type: 'SUBSCRIPTION',
      title: approve ? 'Your milk plan is approved' : 'Your milk plan request was declined',
      body: approve
        ? `${current.productName} · ${Number(current.quantity)} ${current.unit} ${slotLabel(current.slot).toLowerCase()} starts ${startsOn === businessDate() ? 'today' : startsOn}.`
        : note || 'Your milkman could not take this plan on. You can choose another.',
      href: approve ? '/dashboard' : '/subscriptions',
      subjectType: 'milk_subscription',
      subjectId: current.id,
    });

    return row;
  });

  if (approve) await buildDeliveriesFrom(startsOn);
  return { subscription: decided, approved: approve, startsOn: approve ? startsOn : null };
}

/** Generate the rest of the month from a start date. Never fails the caller. */
export async function buildDeliveriesFrom(fromDate) {
  try {
    const { generateForRange } = await import('./delivery.service.js');
    await generateForRange(fromDate, monthEnd(monthOf(fromDate)));
  } catch (err) {
    console.error('Error generating deliveries after approval:', err);
  }
}

/** Pause deliveries. Future scheduled days are withdrawn. */
export async function pause(actor, { rootId }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (current.status !== 'ACTIVE') throw new ConflictError('That subscription is not active.');

  return transaction(async (tx) => {
    const updated = await subscriptionsRepo.setStatus(tx, actor, {
      rootId,
      status: 'PAUSED',
      patch: { pausedAt: new Date() },
    });

    // Tomorrow onward — today's round is already planned and may be underway.
    await deliveriesRepo.cancelFrom(tx, {
      subscriptionRootId: rootId,
      fromDate: addDays(businessDate(), 1),
    });

    await notificationsRepo.create(tx, {
      userId: current.milkmanId,
      type: 'SUBSCRIPTION',
      title: 'Subscription paused',
      body: `${actor.name} paused ${current.productName}.`,
      href: '/milkman/customers',
    });

    return updated;
  });
}

/** Resume a paused subscription. Deliveries from tomorrow are restored and generated. */
export async function resume(actor, { rootId }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (current.status !== 'PAUSED') throw new ConflictError('That subscription is not paused.');

  const today = businessDate();
  const tomorrow = addDays(today, 1);

  const res = await transaction(async (tx) => {
    const updated = await subscriptionsRepo.setStatus(tx, actor, {
      rootId,
      status: 'ACTIVE',
      patch: { pausedAt: null },
    });

    // Restore any scheduled days that were cancelled when pausing
    await deliveriesRepo.restoreCancelledFrom(tx, {
      subscriptionRootId: rootId,
      fromDate: tomorrow,
    });

    await notificationsRepo.create(tx, {
      userId: current.milkmanId,
      type: 'SUBSCRIPTION',
      title: 'Subscription resumed',
      body: `${actor.name} resumed ${current.productName}.`,
      href: '/milkman/customers',
    });

    return updated;
  });

  // Ensure deliveries for the rest of the current month are generated if missing
  try {
    const { generateForRange } = await import('./delivery.service.js');
    const endOfMonth = monthEnd(monthOf(today));
    if (tomorrow <= endOfMonth) {
      await generateForRange(tomorrow, endOfMonth);
    }
  } catch (err) {
    console.error('Error generating deliveries on resume:', err);
  }

  return res;
}

/** Cancel for good. History is kept; the version is closed. */
export async function cancel(actor, { rootId, reason }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (current.status === 'CANCELLED') throw new ConflictError('That subscription is already cancelled.');

  const today = businessDate();

  return transaction(async (tx) => {
    await tx
      .update(milkSubscriptions)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason ?? null,
        // A request withdrawn before it was approved may be dated ahead of
        // today; ending it before it began would break milk_subs_range.
        effectiveTo: current.effectiveFrom > today ? current.effectiveFrom : today,
        updatedAt: new Date(),
      })
      .where(eq(milkSubscriptions.id, current.id));

    /*
     * From today, not tomorrow.
     *
     * `pause` deliberately leaves today alone — the round is planned and the
     * milkman may be out with the milk — but a cancellation is the stronger
     * signal, and leaving the day behind meant the customer kept seeing a
     * delivery for a plan they had just ended, with buttons to adjust it.
     *
     * Only PENDING rows are withdrawn, so anything already delivered stays as
     * the financial record it is.
     */
    await deliveriesRepo.cancelFrom(tx, {
      subscriptionRootId: rootId,
      fromDate: today,
    });

    await notificationsRepo.create(tx, {
      userId: current.milkmanId,
      type: 'SUBSCRIPTION',
      title: current.status === 'PENDING' ? 'Subscription request withdrawn' : 'Subscription cancelled',
      body: `${actor.name} ${current.status === 'PENDING' ? 'withdrew their request for' : 'cancelled'} ${current.productName}${reason ? ` — ${reason}` : ''}.`,
      href: '/milkman/customers',
    });

    return { ok: true };
  });
}

/**
 * Move off a plan the milkman has withdrawn, without asking permission.
 *
 * A customer on a retired plan is stuck: their subscription still holds its
 * delivery time, so every plan on offer reads "already on this", and the only
 * ways out are cancelling milk altogether or waiting on a change request the
 * milkman has to approve. They did not choose to be there — the plan was taken
 * out of the catalog underneath them — so this lets them step across on their
 * own.
 *
 * Deliberately narrow: it refuses unless the plan they are leaving really has
 * been retired. An ordinary plan change still goes through the milkman, which
 * is what keeps a customer from silently repricing themselves.
 */
export async function switchFromRetiredPlan(actor, { rootId, planId }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (current.status !== 'ACTIVE' && current.status !== 'PAUSED') {
    throw new ConflictError('That subscription is not running.');
  }

  const leaving = current.planId
    ? await subscriptionsRepo.findPlan(actor, current.planId)
    : null;
  if (leaving?.isActive !== false) {
    throw new ConflictError(
      'That plan is still offered, so a change has to go through your milkman.',
    );
  }

  const target = await subscriptionsRepo.findPlan(actor, planId);
  if (!target || !target.isActive) throw new NotFoundError('That plan');

  // Everything else the customer holds still has to fit around the new slot.
  const others = (await subscriptionsRepo.listCurrentForCustomer(actor, actor.userId))
    .filter((s) => s.rootId !== rootId);
  assertSlotIsFree(others, { slot: target.slot, productName: target.productName });

  return transaction((tx) => applyPlanChange(tx, actor, { rootId, plan: target }));
}

/**
 * Retire a plan and end every subscription on it.
 *
 * Retiring used to be a catalog action only: the plan stopped being offered and
 * existing customers carried on. That is the gentler behaviour, and it is what
 * the code did for a reason — but it left a customer on a plan nobody could
 * change them to, and a milkman with no way to wind one down.
 *
 * So this now ends them. What that means, precisely:
 *
 *   · Subscriptions on the plan are CANCELLED as of today.
 *   · Their *undelivered* days are withdrawn, from today onward. Anything
 *     already delivered stays exactly as it is — it happened, it is billed, and
 *     a retire must not rewrite money that has already moved.
 *   · Each customer is told, because their milk stops arriving tomorrow.
 *
 * The plan row itself is kept, never deleted, so past enrolments still resolve.
 */
export async function retirePlan(actor, { planId }) {
  const plan = await subscriptionsRepo.findPlan(actor, planId);
  if (!plan) throw new NotFoundError('That plan');

  return transaction(async (tx) => {
    const ended = await endEveryoneOn(tx, actor, plan);
    const retired = await subscriptionsRepo.retirePlan(tx, actor, planId);
    if (!retired) throw new NotFoundError('That plan');
    return { plan: retired, ended };
  });
}

/**
 * Delete a plan.
 *
 * Retiring keeps the row for the record; deleting removes it. Both end the
 * subscriptions still on it first, because a live subscription whose plan has
 * gone would carry on generating deliveries nobody can see the terms of.
 * Pending requests to switch onto the plan go with it (the FK cascades).
 */
export async function deletePlan(actor, { planId }) {
  const plan = await subscriptionsRepo.findPlan(actor, planId);
  if (!plan) throw new NotFoundError('That plan');

  return transaction(async (tx) => {
    const ended = await endEveryoneOn(tx, actor, plan);
    const deleted = await subscriptionsRepo.deletePlan(tx, actor, planId);
    if (!deleted) throw new NotFoundError('That plan');
    return { plan: deleted, ended };
  });
}

/**
 * End every current subscription on a plan from today, withdraw the pending
 * deliveries, and tell each customer. Returns how many were ended.
 */
async function endEveryoneOn(tx, actor, plan) {
  const today = businessDate();
  const subscribers = await subscriptionsRepo.listSubscribersOfPlan(tx, actor, plan.id);

  for (const subscriber of subscribers) {
    await subscriptionsRepo.closeVersion(tx, {
      id: subscriber.versionId,
      // A version dated tomorrow has not run; closing it at today would end
      // it before it began, which `milk_subs_range` refuses.
      effectiveTo: today,
      status: 'CANCELLED',
    });

    await deliveriesRepo.cancelFrom(tx, {
      subscriptionRootId: subscriber.rootId,
      fromDate: today,
    });

    await notificationsRepo.create(tx, {
      userId: subscriber.customerId,
      type: 'SUBSCRIPTION',
      title: 'Your plan has ended',
      body: `${plan.name} is no longer offered, so your ${subscriber.productName} deliveries have stopped. Choose another plan to start again.`,
      href: '/subscriptions',
      subjectType: 'milk_subscription',
      subjectId: subscriber.versionId,
    });
  }

  return subscribers.length;
}

/**
 * Apply a plan change by **versioning**, not by overwriting.
 *
 * The current version is closed with `effectiveTo = today`, and a successor
 * opens tomorrow carrying the new terms. Billing walks both, so a month that
 * spans the change charges each part at the price that was actually in force.
 * The previous system rewrote the row in place, so the whole month silently
 * repriced.
 *
 * Called by the request service once a milkman approves.
 */
/**
 * The milkman changes a customer's plan directly.
 *
 * The same versioned change a customer's request goes through when approved —
 * `applyPlanChange` — so billing, the slot rule and the window cut-off behave
 * identically; only who starts it differs. The customer is told, and any
 * change they had asked for on this subscription is closed, since this one
 * overtakes it.
 *
 * Scoped by the milkman's tenant throughout: `findCurrentByRoot` and
 * `findPlan` only resolve their own customers and their own plans.
 */
export async function changeCustomerPlan(actor, { rootId, planId, quantity }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (!['PENDING', 'ACTIVE', 'PAUSED'].includes(current.status)) {
    throw new ConflictError('That subscription is not running.');
  }

  const plan = await subscriptionsRepo.findPlan(actor, planId);
  if (!plan || !plan.isActive) throw new NotFoundError('That plan');

  const nextQuantity = quantity ?? plan.quantity;
  if (current.planId === plan.id && Number(current.quantity) === Number(nextQuantity)) {
    throw new ConflictError(`They are already on ${plan.name}.`);
  }

  /*
   * A request not yet approved is corrected in place: it has never run, so
   * there is nothing for a versioned change to preserve. It stays waiting;
   * approving the customer (or the request) opens it on the new terms.
   */
  if (current.status === 'PENDING') {
    const month = current.effectiveFrom.slice(0, 7);
    const quote = quoteForQuantity(plan, { quantity: nextQuantity }, month);
    const others = (await subscriptionsRepo.listCurrentForCustomer(actor, current.customerId))
      .filter((s) => s.rootId !== rootId);
    assertSlotIsFree(others, { slot: plan.slot, productName: plan.productName });

    return transaction(async (tx) => {
      const amended = await subscriptionsRepo.amendRequest(tx, {
        id: current.id,
        patch: {
          planId: plan.id,
          productName: plan.productName,
          quantity: String(nextQuantity),
          unit: plan.unit,
          frequency: plan.frequency,
          slot: plan.slot,
          ...windowsFor(plan, plan.slot),
          unitPrice: quote.unitPrice,
          quotedMonthlyPrice: paiseToDecimal(quote.monthlyPaise),
        },
      });
      if (!amended) throw new ConflictError('That request was answered while you were editing it.');

      await notificationsRepo.create(tx, {
        userId: current.customerId,
        type: 'PLAN_CHANGE',
        title: 'Your milkman adjusted your plan request',
        body: `${plan.name}: ${Number(nextQuantity)} ${plan.unit} ${slotLabel(plan.slot).toLowerCase()}, about ${formatPaise(quote.monthlyPaise, { whole: true })} a month.`,
        href: '/subscriptions',
        subjectType: 'milk_subscription',
        subjectId: current.id,
      });

      return { subscription: amended, planName: plan.name, effectiveFrom: amended.effectiveFrom };
    });
  }

  return transaction(async (tx) => {
    const next = await applyPlanChange(tx, actor, {
      rootId,
      plan,
      overrides: quantity != null ? { quantity: String(quantity) } : {},
    });

    await requestsRepo.declinePendingPlanChangesForRoot(tx, actor, {
      rootId,
      note: `Your milkman changed this plan to ${plan.name}.`,
    });

    await notificationsRepo.create(tx, {
      userId: current.customerId,
      type: 'PLAN_CHANGE',
      title: 'Your milkman changed your plan',
      body:
        `${current.productName} ${Number(current.quantity)} ${current.unit} → ` +
        `${plan.name} (${Number(nextQuantity)} ${plan.unit}), from ${next.effectiveFrom === businessDate() ? 'today' : next.effectiveFrom}.`,
      href: '/subscriptions',
      subjectType: 'milk_subscription',
      subjectId: next.id,
    });

    return { subscription: next, planName: plan.name, effectiveFrom: next.effectiveFrom };
  });
}

export async function applyPlanChange(tx, actor, { rootId, plan, overrides = {} }) {
  const [current] = await tx
    .select()
    .from(milkSubscriptions)
    .where(eq(milkSubscriptions.rootId, rootId))
    .orderBy(milkSubscriptions.effectiveFrom)
    .limit(1);

  const currentVersion = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!currentVersion) throw new NotFoundError('That subscription');

  const today = businessDate();

  /*
   * When the new terms start, decided by the round rather than by the calendar.
   *
   * A change used to always begin tomorrow, so that a customer could not alter
   * a round the milkman was already out delivering. Right for the milkman, but
   * wrong for anyone changing before dawn: they waited a whole extra day for
   * milk that had not been loaded yet.
   *
   * So it now turns on the delivery window. If a slot's round has not set off,
   * the change reaches it today; if it has, that slot waits until tomorrow.
   *
   * The same-day path needs the outgoing version closed *yesterday*, or the two
   * would both be in force today. When the current version itself started
   * today there is no yesterday to close it at, so that case keeps the old
   * behaviour — rare, and safe.
   */
  const aheadToday = slotsStillAheadToday({ ...plan, slot: overrides.slot ?? plan.slot });
  const startsToday = aheadToday.length > 0 && currentVersion.effectiveFrom < today;

  const effectiveFrom = startsToday ? today : addDays(today, 1);
  const month = effectiveFrom.slice(0, 7);

  const quantity = overrides.quantity ?? plan.quantity;
  const nextSlot = overrides.slot ?? plan.slot;
  // The plan's rate, scaled to the quantity agreed. Before, an override kept
  // the plan's per-delivery price and divided it by the new amount.
  const quote = quoteForQuantity(plan, { quantity, slot: nextSlot }, month);
  const { unitPrice } = quote;

  /*
   * A change can collide too.
   *
   * Moving an evening plan onto a morning-and-evening one takes a time the
   * customer may already have filled with something else. The subscription
   * being changed is excluded — it is giving up its own slot in the same
   * breath, so it cannot block itself.
   */
  const others = (
    await subscriptionsRepo.listCurrentForCustomer(actor, currentVersion.customerId)
  ).filter((s) => s.rootId !== rootId);
  assertSlotIsFree(others, {
    slot: nextSlot,
    productName: overrides.productName ?? plan.productName,
  });

  const terms = {
    planId: plan.id,
    productName: overrides.productName ?? plan.productName,
    quantity,
    unit: overrides.unit ?? plan.unit,
    frequency: overrides.frequency ?? plan.frequency,
    slot: nextSlot,
    ...windowsFor(plan, nextSlot),
    unitPrice,
    quotedMonthlyPrice: paiseToDecimal(quote.monthlyPaise),
  };

  /*
   * A version that has not started yet is amended, not superseded.
   *
   * Changes take effect tomorrow, so changing twice in one day leaves a current
   * version dated tomorrow that has delivered nothing. Closing it "at the end of
   * today" would end it the day before it began — which `milk_subs_range`
   * refuses, and which is why approving the second change failed outright.
   *
   * Nothing was ever in force under those terms, so there is no history for a
   * successor to protect and amending is honest. Versioning still applies the
   * moment a version has actually run.
   */
  if (currentVersion.effectiveFrom > today) {
    const amended = await subscriptionsRepo.amendPendingVersion(tx, {
      id: currentVersion.id,
      today,
      patch: terms,
    });
    if (!amended) throw new ConflictError('That subscription changed while you were deciding.');

    await deliveriesRepo.cancelFrom(tx, {
      subscriptionRootId: rootId,
      fromDate: currentVersion.effectiveFrom,
    });

    return amended;
  }

  // Close the outgoing version the day before the new one opens, so the two
  // never overlap.
  await subscriptionsRepo.closeVersion(tx, {
    id: currentVersion.id,
    effectiveTo: startsToday ? addDays(today, -1) : today,
    status: 'SUPERSEDED',
  });

  // Open the successor, sharing the root so delivery history stays attached.
  const next = await subscriptionsRepo.insertSubscription(tx, {
    rootId,
    supersedesId: currentVersion.id,
    customerId: currentVersion.customerId,
    milkmanId: currentVersion.milkmanId,
    // The successor takes the new plan's windows, like every other agreed term.
    ...terms,
    status: 'ACTIVE',
    effectiveFrom,
  });

  // Withdraw scheduled days that belong to the old terms; the generator will
  // recreate them from the new version.
  // Tomorrow onward is withdrawn either way; the nightly generator rebuilds it
  // from the new version. Today is handled below, because it may already have
  // a row that must not be duplicated.
  await deliveriesRepo.cancelFrom(tx, {
    subscriptionRootId: rootId,
    fromDate: addDays(today, 1),
  });

  /*
   * Today's deliveries, when today is included.
   *
   * The generator will not run again until tomorrow, so a change taking effect
   * now has to see to its own day. An existing undelivered row is *retargeted*
   * rather than cancelled and replaced: the unique index covers (root, date,
   * slot), so a cancelled row would block the replacement and the day would go
   * blank. Only slots whose round has not set off — one already delivered stays
   * exactly as it was.
   */
  if (startsToday) {
    for (const slot of aheadToday) {
      const terms = {
        subscriptionVersionId: next.id,
        productName: next.productName,
        unit: next.unit,
        plannedQuantity: next.quantity,
        unitPrice: next.unitPrice,
      };

      const retargeted = await deliveriesRepo.retargetPending(tx, {
        subscriptionRootId: rootId,
        date: today,
        slot,
        patch: terms,
      });

      // No row for that slot yet — the old plan did not cover it.
      if (!retargeted) {
        await deliveriesRepo.insertGenerated(tx, [
          {
            subscriptionRootId: rootId,
            customerId: next.customerId,
            milkmanId: next.milkmanId,
            deliveryDate: today,
            slot,
            status: 'PENDING',
            ...terms,
          },
        ]);
      }
    }
  }

  return next;
}
