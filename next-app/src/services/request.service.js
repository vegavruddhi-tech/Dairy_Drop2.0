/**
 * Quantity-change and plan-change requests.
 *
 * The distinction the previous system lost: a quantity request touches **one
 * delivery on one date**, and nothing else. A plan change replaces the
 * subscription, and does so by versioning rather than overwriting.
 */

import 'server-only';

import { db, transaction } from '@/db/index.js';
import { businessDate, businessMonth, formatDate, isPastDeliveryCutoff } from '@/domain/dates.js';
import { toMilli, milliToDecimal } from '@/domain/money.js';
import { quotedMonthlyPaise } from '@/domain/pricing.js';
import { paiseToDecimal } from '@/domain/money.js';
import { ValidationError, NotFoundError, ConflictError } from '@/domain/errors.js';

import * as requestsRepo from '@/repositories/requests.repo.js';
import * as deliveriesRepo from '@/repositories/deliveries.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import { applyPlanChange } from './subscription.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Quantity changes
// ─────────────────────────────────────────────────────────────────────────────

/** Ask for a different quantity on one specific day. */
export async function requestQuantityChange(actor, { deliveryId, quantity, note }) {
  const delivery = await deliveriesRepo.findById(actor, deliveryId);
  if (!delivery) throw new NotFoundError('That delivery');
  if (delivery.status !== 'PENDING') {
    throw new ConflictError('That day can no longer be changed.');
  }

  // Enforce cutoff time
  if (isPastDeliveryCutoff(delivery.deliveryDate, delivery.slot)) {
    throw new ConflictError(
      `Modifications for ${delivery.deliveryDate} (${delivery.slot.toLowerCase()} round) are closed after cutoff time (10:00 PM). Please contact your milkman directly.`,
    );
  }

  const milli = toMilli(quantity);
  if (milli <= 0) throw new ValidationError('Enter a quantity greater than zero.');
  if (milli > 100_000) throw new ValidationError('That quantity is too large.');

  const plannedMilli = toMilli(delivery.plannedQuantity);

  return transaction(async (tx) => {
    // If setting back to standard plan
    if (milli === plannedMilli) {
      await requestsRepo.cancelPendingQuantityRequestsForDelivery(tx, actor, deliveryId);
      const updated = await deliveriesRepo.setAdjustedQuantity(tx, actor, {
        id: deliveryId,
        quantity: null,
        note: null,
      });

      await notificationsRepo.create(tx, {
        userId: delivery.milkmanId,
        type: 'QUANTITY_CHANGE',
        title: 'Back to the usual amount',
        body: `${actor.name} is back to ${Number(delivery.plannedQuantity)} ${delivery.unit} for ${delivery.deliveryDate}.`,
        href: '/milkman/requests',
        subjectType: 'delivery',
        subjectId: delivery.id,
      });

      return { ...updated, status: 'RESET' };
    }

    // Check if there is already a pending request for this delivery
    const existing = await requestsRepo.findPendingForDelivery(tx, actor, deliveryId);
    let request;
    if (existing) {
      request = await requestsRepo.updatePendingQuantityRequest(tx, actor, {
        id: existing.id,
        requestedQuantity: milliToDecimal(milli),
        customerNote: note ?? null,
      });
    } else {
      request = await requestsRepo.createQuantityRequest(tx, {
        customerId: actor.userId,
        milkmanId: delivery.milkmanId,
        deliveryId,
        deliveryDate: delivery.deliveryDate,
        currentQuantity: delivery.adjustedQuantity ?? delivery.plannedQuantity,
        requestedQuantity: milliToDecimal(milli),
        customerNote: note ?? null,
        status: 'PENDING',
      });
    }

    await notificationsRepo.create(tx, {
      userId: delivery.milkmanId,
      type: 'QUANTITY_CHANGE',
      title: 'Quantity change requested',
      body: `${actor.name} requested ${Number(quantity)} ${delivery.unit} on ${formatDate(delivery.deliveryDate)} (usually ${Number(delivery.plannedQuantity)}).`,
      href: '/milkman/requests',
      subjectType: 'quantity_change_request',
      subjectId: request.id,
    });

    return request;
  });
}

/**
 * Approve or decline a quantity request.
 *
 * On approval this writes `adjustedQuantity` on **that one delivery**. It does
 * not touch the subscription — the previous implementation permanently rewrote
 * the customer's standard quantity across every plan they held.
 */
export async function resolveQuantityRequest(actor, { requestId, approve, note }) {
  const request = await requestsRepo.findQuantityRequest(actor, requestId);
  if (!request) throw new NotFoundError('That request');
  if (request.status !== 'PENDING') throw new ConflictError('That request has already been answered.');

  return transaction(async (tx) => {
    const resolved = await requestsRepo.resolveQuantityRequest(tx, actor, {
      id: requestId,
      status: approve ? 'APPROVED' : 'REJECTED',
      milkmanNote: note ?? null,
    });
    if (!resolved) throw new ConflictError('That request has already been answered.');

    if (approve) {
      await deliveriesRepo.setAdjustedQuantity(tx, actor, {
        id: request.deliveryId,
        quantity: request.requestedQuantity,
        note: note ?? null,
      });
    }

    await notificationsRepo.create(tx, {
      userId: request.customerId,
      type: 'QUANTITY_CHANGE',
      title: approve ? 'Quantity change approved' : 'Quantity change declined',
      body: approve
        ? `${Number(request.requestedQuantity)} will be delivered on ${formatDate(request.deliveryDate)}.`
        : note ?? 'Your milkman could not change that day.',
      href: '/calendar',
      subjectType: 'quantity_change_request',
      subjectId: requestId,
    });

    return resolved;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan changes
// ─────────────────────────────────────────────────────────────────────────────

/** Ask to move a subscription onto a different plan. */
export async function requestPlanChange(actor, { rootId, planId, note }) {
  const reason = String(note ?? '').trim();
  if (!reason) throw new ValidationError('Tell your milkman why you would like to change.');

  const current = await subscriptionsRepo.findCurrentByRoot(actor, rootId);
  if (!current) throw new NotFoundError('That subscription');
  if (current.status !== 'ACTIVE') throw new ConflictError('That subscription is not active.');
  if (current.planId === planId) throw new ConflictError('You are already on that plan.');

  const plan = await subscriptionsRepo.findPlan(actor, planId);
  if (!plan || !plan.isActive) throw new NotFoundError('That plan');

  const month = businessMonth();

  return transaction(async (tx) => {
    const request = await requestsRepo.createPlanChangeRequest(tx, {
      customerId: actor.userId,
      milkmanId: current.milkmanId,
      subscriptionRootId: rootId,
      requestedPlanId: plan.id,
      currentPlanName: current.productName,
      currentQuantity: current.quantity,
      currentUnit: current.unit,
      currentMonthlyPrice: current.quotedMonthlyPrice,
      requestedPlanName: plan.name,
      requestedQuantity: plan.quantity,
      requestedUnit: plan.unit,
      requestedMonthlyPrice: paiseToDecimal(quotedMonthlyPaise(plan, month)),
      requestedSlot: plan.slot,
      customerNote: reason,
      status: 'PENDING',
    });

    await notificationsRepo.create(tx, {
      userId: current.milkmanId,
      type: 'PLAN_CHANGE',
      title: 'Plan change requested',
      body: `${actor.name}: ${current.productName} → ${plan.name}. "${reason}"`,
      href: '/milkman/requests',
      subjectType: 'plan_change_request',
      subjectId: request.id,
    });

    return request;
  });
}

/**
 * Approve or decline a plan change.
 *
 * Approval closes the current subscription version today and opens a successor
 * tomorrow. The milkman may adjust the terms before applying them.
 */
export async function resolvePlanChangeRequest(actor, { requestId, approve, note, overrides }) {
  const request = await requestsRepo.findPlanChangeRequest(actor, requestId);
  if (!request) throw new NotFoundError('That request');
  if (request.status !== 'PENDING') throw new ConflictError('That request has already been answered.');

  return transaction(async (tx) => {
    const resolved = await requestsRepo.resolvePlanChangeRequest(tx, actor, {
      id: requestId,
      status: approve ? 'APPROVED' : 'REJECTED',
      milkmanNote: note ?? null,
    });
    if (!resolved) throw new ConflictError('That request has already been answered.');

    if (approve) {
      const plan = await subscriptionsRepo.findPlan(actor, request.requestedPlanId);
      if (!plan || !plan.isActive) {
        throw new ConflictError('That plan is no longer available.');
      }

      await applyPlanChange(tx, actor, {
        rootId: request.subscriptionRootId,
        plan,
        overrides: overrides ?? {},
      });
    }

    await notificationsRepo.create(tx, {
      userId: request.customerId,
      type: 'PLAN_CHANGE',
      title: approve ? 'Plan changed' : 'Plan change declined',
      body: approve
        ? `You are on ${request.requestedPlanName} from tomorrow.`
        : note ?? 'Your milkman could not make that change.',
      href: '/subscriptions',
      subjectType: 'plan_change_request',
      subjectId: requestId,
    });

    return resolved;
  });
}

/** The milkman's combined request inbox. */
export async function listInbox(actor) {
  const [quantity, plan, counts] = await Promise.all([
    requestsRepo.listQuantityRequests(actor, { status: 'PENDING' }),
    requestsRepo.listPlanChangeRequests(actor, { status: 'PENDING' }),
    requestsRepo.countPendingRequests(actor),
  ]);
  return { quantity, plan, counts };
}
