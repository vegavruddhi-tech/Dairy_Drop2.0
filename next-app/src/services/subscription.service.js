/**
 * Customer subscription use cases, including the versioned plan change.
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import { milkSubscriptions } from '@/db/schema/index.js';
import { businessDate, businessMonth, addDays } from '@/domain/dates.js';
import { resolveUnitPrice, quotedMonthlyPaise } from '@/domain/pricing.js';
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
  const { unitPrice } = resolveUnitPrice(plan, month);

  const existing = await subscriptionsRepo.listCurrentForCustomer(actor, actor.userId);
  if (existing.some((s) => s.planId === plan.id && s.status === 'ACTIVE')) {
    throw new ConflictError('You are already subscribed to that plan.');
  }

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
      slot: slot ?? plan.slot,
      // Snapshotted with the rest of the agreed terms: editing the plan later
      // must not silently move the time this customer was promised.
      ...windowsFor(plan, slot ?? plan.slot),
      unitPrice,
      quotedMonthlyPrice: paiseToDecimal(quotedMonthlyPaise(plan, month)),
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

    await deliveriesRepo.cancelFrom(tx, {
      subscriptionRootId: rootId,
      fromDate: addDays(today, 1),
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
  const { unitPrice } = resolveUnitPrice({ ...plan, quantity }, month);

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
    planId: plan.id,
    productName: overrides.productName ?? plan.productName,
    quantity,
    unit: overrides.unit ?? plan.unit,
    frequency: overrides.frequency ?? plan.frequency,
    slot: overrides.slot ?? plan.slot,
    // The successor takes the new plan's windows, like every other agreed term.
    ...windowsFor(plan, overrides.slot ?? plan.slot),
    unitPrice,
    quotedMonthlyPrice: paiseToDecimal(quotedMonthlyPaise({ ...plan, quantity }, month)),
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
