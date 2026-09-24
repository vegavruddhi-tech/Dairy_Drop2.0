/**
 * SaaS use cases: trials, plan purchase, admin verification, expiry.
 *
 * The single most important rule in this file is the expiry rule, which is now
 * exactly one line: a subscription lapses when `endsAt` passes. The previous
 * implementation also expired anything without a `payment_reference` after 7
 * days, which force-expired every paying milkman on day 8.
 */

import 'server-only';
import { eq, and, inArray } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import { saasSubscriptions, saasPayments, users, milkmanProfiles } from '@/db/schema/index.js';
import { ValidationError, ConflictError, NotFoundError } from '@/domain/errors.js';
import { daysRemaining, evaluateSaasAccess } from '@/auth/policy.js';

import * as saasRepo from '@/repositories/saas.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import * as auditService from './audit.service.js';

/** The milkman's membership panel: current state, plans, history. */
export async function getMembership(actor) {
  const [current, plans, history, settings, customerCount] = await Promise.all([
    saasRepo.findCurrentSaasSubscription(actor.userId),
    saasRepo.listActiveSaasPlans(),
    saasRepo.listSaasSubscriptions(actor.userId),
    saasRepo.getPlatformSettings(),
    subscriptionsRepo.countActiveCustomers(db, actor.userId),
  ]);

  const trialUsed = await saasRepo.hasUsedTrial(actor.userId);
  const access = evaluateSaasAccess(current);
  const limit = current?.customerLimit ?? null;

  // A payment in the queue that sits beside a live plan is a plan change.
  const pending = await saasRepo.findPendingSaasSubscription(actor.userId);
  const pendingChange = pending && pending.id !== current?.id ? pending : null;

  return {
    current,
    access,
    pendingChange,
    plans,
    history,
    settings,
    trialUsed,
    customerCount,
    customerLimit: limit,
    // Nudge an upgrade before the ceiling is hit, not after.
    nearLimit: limit ? customerCount >= limit * 0.8 || limit - customerCount <= 1 : false,
    daysRemaining: daysRemaining(current),
  };
}

/**
 * Start the 7-day free trial. Once per account, ever.
 *
 * The partial unique index on `saas_subscriptions` enforces both "one trial" and
 * "one live subscription", so a double-submit cannot create two.
 */
export async function startTrial(actor) {
  const settings = await saasRepo.getPlatformSettings();

  if (await saasRepo.hasUsedTrial(actor.userId)) {
    throw new ConflictError('You have already used your free trial.');
  }

  const existing = await saasRepo.findCurrentSaasSubscription(actor.userId);
  if (existing) {
    throw new ConflictError('You already have an active subscription.');
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + settings.trialDurationDays);

  return transaction(async (tx) => {
    const [subscription] = await tx
      .insert(saasSubscriptions)
      .values({
        milkmanId: actor.userId,
        planId: null,
        status: 'TRIAL',
        startsAt,
        endsAt,
        customerLimit: settings.trialCustomerLimit,
        pricePaid: '0',
      })
      .returning();

    await notificationsRepo.create(tx, {
      userId: actor.userId,
      type: 'SUBSCRIPTION',
      title: 'Free trial started',
      body: `You have ${settings.trialDurationDays} days and up to ${settings.trialCustomerLimit} customers. Choose a plan any time to continue.`,
      href: '/milkman/membership',
    });

    return subscription;
  });
}

/**
 * Submit a bank reference for a paid plan.
 *
 * The milkman pays offline to the platform's UPI or QR, then records the UTR
 * here. An admin verifies it against the bank statement before access opens.
 */
export async function submitPayment(actor, { planId, reference }) {
  const plan = await saasRepo.findSaasPlan(planId);
  if (!plan || !plan.isActive) throw new NotFoundError('That plan');

  const trimmed = String(reference ?? '').trim();
  if (trimmed.length < 6) {
    throw new ValidationError('Enter the full transaction reference from your bank or UPI app.');
  }

  if (await saasRepo.findPendingSaasSubscription(actor.userId)) {
    throw new ConflictError('We are already checking a payment from you.');
  }

  /*
   * Changing plans.
   *
   * A live plan (ACTIVE or TRIAL) is left running: the new one only takes
   * over when an administrator verifies the payment, so nothing goes dark
   * while the reference is being checked. Two things are refused up front —
   * paying again for the plan you are already on, and moving to a plan with
   * fewer seats than customers you serve.
   */
  const current = await saasRepo.findCurrentSaasSubscription(actor.userId);
  if (current?.status === 'ACTIVE' && current.planId === plan.id) {
    throw new ConflictError(`You are already on ${plan.name}.`);
  }
  const customerCount = await subscriptionsRepo.countActiveCustomers(db, actor.userId);
  if (customerCount > plan.maxCustomers) {
    throw new ConflictError(
      `You serve ${customerCount} customers and ${plan.name} allows ${plan.maxCustomers}. ` +
        'Choose a bigger plan, or remove some customers first.',
    );
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + plan.durationDays);

  return transaction(async (tx) => {
    const [subscription] = await tx
      .insert(saasSubscriptions)
      .values({
        milkmanId: actor.userId,
        planId: plan.id,
        status: 'PENDING_VERIFICATION',
        startsAt,
        endsAt,
        customerLimit: plan.maxCustomers,
        pricePaid: plan.monthlyPrice,
        paymentReference: trimmed,
      })
      .returning();

    await tx.insert(saasPayments).values({
      milkmanId: actor.userId,
      subscriptionId: subscription.id,
      amount: plan.monthlyPrice,
      reference: trimmed,
      status: 'SUBMITTED',
    });

    // Tell every administrator there is something in the queue.
    const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
    await notificationsRepo.create(
      tx,
      admins.map((admin) => ({
        userId: admin.id,
        type: 'PAYMENT',
        title: 'Subscription payment to verify',
        body: current
          ? `${actor.name} submitted ${trimmed} to change from ${current.planName ?? 'the free trial'} to ${plan.name}.`
          : `${actor.name} submitted ${trimmed} for ${plan.name}.`,
        href: '/admin/verifications',
        subjectType: 'saas_subscription',
        subjectId: subscription.id,
      })),
    );

    return subscription;
  });
}

/**
 * Admin decision on a submitted payment.
 *
 * On approval the period runs from **now**, for the plan's duration. If the
 * milkman was on another plan it is closed the same moment — days left on it
 * are not carried over. If you would rather a change or an early renewal
 * extend the remaining time, change it here — this is the one place that
 * decides it.
 */
export async function verifyPayment(actor, { subscriptionId, approve, rejectionReason }) {
  return transaction(async (tx) => {
    const [subscription] = await tx
      .select()
      .from(saasSubscriptions)
      .where(
        and(
          eq(saasSubscriptions.id, subscriptionId),
          eq(saasSubscriptions.status, 'PENDING_VERIFICATION'),
        ),
      )
      .limit(1);

    if (!subscription) throw new NotFoundError('That payment');

    const now = new Date();

    if (approve) {
      const plan = subscription.planId ? await saasRepo.findSaasPlan(subscription.planId) : null;
      const endsAt = new Date(now);
      endsAt.setDate(endsAt.getDate() + (plan?.durationDays ?? 30));

      // The plan they were on, if any. Closed first: only one live row may exist.
      const [previous] = await tx
        .select({ id: saasSubscriptions.id, planId: saasSubscriptions.planId, status: saasSubscriptions.status })
        .from(saasSubscriptions)
        .where(
          and(
            eq(saasSubscriptions.milkmanId, subscription.milkmanId),
            inArray(saasSubscriptions.status, ['ACTIVE', 'TRIAL']),
          ),
        )
        .limit(1);
      const previousPlan = previous?.planId ? await saasRepo.findSaasPlan(previous.planId) : null;
      const previousName = previous ? previousPlan?.name ?? 'Free trial' : null;

      if (previous) {
        await tx
          .update(saasSubscriptions)
          .set({
            status: 'CANCELLED',
            cancelledAt: now,
            cancellationReason: `Changed to ${plan?.name ?? 'a new plan'}`,
            updatedAt: now,
          })
          .where(eq(saasSubscriptions.id, previous.id));
      }

      await tx
        .update(saasSubscriptions)
        .set({ status: 'ACTIVE', startsAt: now, endsAt, updatedAt: now })
        .where(eq(saasSubscriptions.id, subscriptionId));

      await tx
        .update(saasPayments)
        .set({ status: 'VERIFIED', verifiedBy: actor.userId, verifiedAt: now })
        .where(eq(saasPayments.subscriptionId, subscriptionId));

      await notificationsRepo.create(tx, {
        userId: subscription.milkmanId,
        type: 'SUBSCRIPTION',
        title: previousName ? `You are now on ${plan?.name ?? 'your new plan'}` : 'Your plan is active',
        body: previousName
          ? `Payment verified. You have moved from ${previousName} to ${plan?.name ?? 'your new plan'}; your panel is open until ${endsAt.toDateString()}.`
          : `Payment verified. Your panel is open until ${endsAt.toDateString()}.`,
        href: '/milkman/membership',
      });

      await auditService.record(tx, actor, {
        action: 'SAAS_PAYMENT_VERIFIED',
        subjectType: 'saas_subscription',
        subjectId: subscriptionId,
        metadata: { reference: subscription.paymentReference, endsAt, changedFrom: previousName },
      });

      return { approved: true };
    }

    await tx
      .update(saasSubscriptions)
      .set({
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: rejectionReason ?? 'Payment could not be verified',
        updatedAt: now,
      })
      .where(eq(saasSubscriptions.id, subscriptionId));

    await tx
      .update(saasPayments)
      .set({ status: 'REJECTED', rejectionReason, verifiedBy: actor.userId, verifiedAt: now })
      .where(eq(saasPayments.subscriptionId, subscriptionId));

    await notificationsRepo.create(tx, {
      userId: subscription.milkmanId,
      type: 'PAYMENT',
      title: 'We could not verify your payment',
      body: `${rejectionReason ?? 'The reference did not match a payment we received.'} Please check and submit again.`,
      href: '/milkman/membership',
    });

    await auditService.record(tx, actor, {
      action: 'SAAS_PAYMENT_REJECTED',
      subjectType: 'saas_subscription',
      subjectId: subscriptionId,
      metadata: { reference: subscription.paymentReference, rejectionReason },
    });

    return { approved: false };
  });
}

/**
 * Expire lapsed subscriptions.
 *
 * One rule: `endsAt` has passed. Trials are given an `endsAt` when they are
 * created, so they need no special case.
 */
export async function expireLapsed(now = new Date()) {
  const lapsed = await saasRepo.findLapsedSubscriptions(now);
  if (lapsed.length === 0) return { expired: 0 };

  const count = await saasRepo.markExpired(lapsed.map((row) => row.id));

  await transaction(async (tx) => {
    await notificationsRepo.create(
      tx,
      lapsed.map((row) => ({
        userId: row.milkmanId,
        type: 'SUBSCRIPTION',
        title: 'Your subscription has ended',
        body: 'Renew your plan to reopen your panel. Your customers and history are safe.',
        href: '/milkman/activate',
      })),
    );
  });

  return { expired: count };
}

/** Cancel voluntarily. Access continues until the period already paid for ends. */
export async function cancel(actor, { reason } = {}) {
  const current = await saasRepo.findCurrentSaasSubscription(actor.userId);
  if (!current) throw new NotFoundError('An active subscription');

  return transaction(async (tx) => {
    const [row] = await tx
      .update(saasSubscriptions)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason ?? 'Cancelled by the milkman',
        updatedAt: new Date(),
      })
      .where(eq(saasSubscriptions.id, current.id))
      .returning();
    return row;
  });
}
