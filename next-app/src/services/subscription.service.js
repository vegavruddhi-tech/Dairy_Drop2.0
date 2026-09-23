/**
 * Customer subscription use cases, including the versioned plan change.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import { milkSubscriptions } from '@/db/schema/index.js';
import { businessDate, businessMonth, addDays } from '@/domain/dates.js';
import { resolveUnitPrice, quotedMonthlyPaise, clashingSlots, slotLabel } from '@/domain/pricing.js';
import { paiseToDecimal } from '@/domain/money.js';
import { NotFoundError, ConflictError, ValidationError } from '@/domain/errors.js';

import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import * as deliveriesRepo from '@/repositories/deliveries.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
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
  // would let something else take it with no way to resume.
  return subscription.status === 'ACTIVE' || subscription.status === 'PAUSED';
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

export async function subscribe(actor, { planId, startDate, slot }) {
  const plan = await subscriptionsRepo.findPlan(actor, planId);
  if (!plan || !plan.isActive) throw new NotFoundError('That plan');

  const effectiveFrom = startDate ?? businessDate();
  const month = effectiveFrom.slice(0, 7);

  /*
   * Price and quote for the slot this customer actually takes.
   *
   * A customer may take only the morning half of a "morning & evening" plan.
   * The per-unit rate is the same either way, but the monthly quote is not:
   * quoting the plan's own slot would have promised them a full month of two
   * drops a day while they receive one.
   */
  const chosenSlot = slot ?? plan.slot;
  const agreed = { ...plan, slot: chosenSlot };
  const { unitPrice } = resolveUnitPrice(agreed, month);

  const existing = await subscriptionsRepo.listCurrentForCustomer(actor, actor.userId);
  if (existing.some((s) => s.planId === plan.id && s.status === 'ACTIVE')) {
    throw new ConflictError('You are already subscribed to that plan.');
  }

  const activeCount = existing.filter((s) => s.status === 'ACTIVE' || s.status === 'PAUSED').length;
  if (activeCount >= 2) {
    throw new ValidationError('You can have a maximum of 2 active milk plans at a time. Please cancel or change an existing plan first.');
  }

  assertSlotIsFree(existing, { slot: chosenSlot, productName: plan.productName });

  const res = await transaction(async (tx) => {
    const rootId = randomUUID();

    const subscription = await subscriptionsRepo.insertSubscription(tx, {
      id: rootId,
      rootId,
      customerId: actor.userId,
      milkmanId: actor.tenantId,
      planId: plan.id,
      productName: plan.productName,
      quantity: plan.quantity,
      unit: plan.unit,
      frequency: plan.frequency,
      slot: chosenSlot,
      // Snapshotted with the rest of the agreed terms: editing the plan later
      // must not silently move the time this customer was promised.
      ...windowsFor(plan, chosenSlot),
      unitPrice,
      quotedMonthlyPrice: paiseToDecimal(quotedMonthlyPaise(agreed, month)),
      status: 'ACTIVE',
      effectiveFrom,
    });

    await notificationsRepo.create(tx, {
      userId: actor.tenantId,
      type: 'SUBSCRIPTION',
      title: 'New subscription',
      body: `${actor.name} subscribed to ${plan.name} (${Number(plan.quantity)} ${plan.unit}, ${plan.slot.toLowerCase()}).`,
      href: '/milkman/customers',
      subjectType: 'milk_subscription',
      subjectId: subscription.id,
    });

    return subscription;
  });

  try {
    const { generateForDate } = await import('./delivery.service.js');
    await generateForDate(effectiveFrom);
  } catch (err) {
    console.error('Error generating deliveries on subscribe:', err);
  }

  return res;
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

/** Resume a paused subscription. The generator picks it up from tomorrow. */
export async function resume(actor, { rootId }) {
  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (current.status !== 'PAUSED') throw new ConflictError('That subscription is not paused.');

  return transaction(async (tx) => {
    const updated = await subscriptionsRepo.setStatus(tx, actor, {
      rootId,
      status: 'ACTIVE',
      patch: { pausedAt: null },
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
        effectiveTo: today,
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
      title: 'Subscription cancelled',
      body: `${actor.name} cancelled ${current.productName}${reason ? ` — ${reason}` : ''}.`,
      href: '/milkman/customers',
    });

    return { ok: true };
  });
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

  const today = businessDate();

  return transaction(async (tx) => {
    const subscribers = await subscriptionsRepo.listSubscribersOfPlan(tx, actor, planId);

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

    const retired = await subscriptionsRepo.retirePlan(tx, actor, planId);
    if (!retired) throw new NotFoundError('That plan');

    return { plan: retired, ended: subscribers.length };
  });
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
  const effectiveFrom = addDays(today, 1);
  const month = effectiveFrom.slice(0, 7);

  const quantity = overrides.quantity ?? plan.quantity;
  const nextSlot = overrides.slot ?? plan.slot;
  const agreed = { ...plan, quantity, slot: nextSlot };
  const { unitPrice } = resolveUnitPrice(agreed, month);

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
    quotedMonthlyPrice: paiseToDecimal(quotedMonthlyPaise(agreed, month)),
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

  // Close the outgoing version at the end of today.
  await subscriptionsRepo.closeVersion(tx, {
    id: currentVersion.id,
    effectiveTo: today,
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
  await deliveriesRepo.cancelFrom(tx, {
    subscriptionRootId: rootId,
    fromDate: effectiveFrom,
  });

  return next;
}
