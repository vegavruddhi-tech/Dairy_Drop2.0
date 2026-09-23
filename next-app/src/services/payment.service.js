/**
 * Customer payments: submission by the customer, verification by the milkman.
 *
 * Two properties this file guarantees, both of which the previous system lacked:
 *   · A payment always belongs to exactly one bill, so it can never be counted
 *     against another month.
 *   · Verification is idempotent — the bill's paid total is recomputed as a sum,
 *     not incremented, and the status transition only fires from SUBMITTED.
 */

import 'server-only';

import { db, transaction } from '@/db/index.js';
import { businessMonth, monthEnd, formatMonth } from '@/domain/dates.js';
import { toPaise, formatPaise } from '@/domain/money.js';
import { ValidationError, NotFoundError, ConflictError } from '@/domain/errors.js';

import * as billingRepo from '@/repositories/billing.repo.js';
import * as usersRepo from '@/repositories/users.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import { materialiseBill } from './billing.service.js';

/** Where the customer should send the money. */
export async function getPaymentInfo(actor) {
  if (!actor.tenantId) throw new NotFoundError('Your milkman');
  return usersRepo.findMilkmanPaymentInfo(actor.tenantId);
}

/**
 * Record a payment the customer says they have made.
 *
 * Creates the bill row for the month if it does not exist yet, so the payment
 * has something to attach to.
 */
export async function submit(actor, { month, amount, method, reference, note }) {
  const targetMonth = month ?? businessMonth();
  const paise = toPaise(amount);

  if (paise <= 0) throw new ValidationError('Enter the amount you paid.');
  if (method === 'UPI' && !String(reference ?? '').trim()) {
    throw new ValidationError('Enter the UPI reference or UTR from your payment app.');
  }

  return transaction(async (tx) => {
    const { bill, computed } = await materialiseBill(tx, actor, {
      customerId: actor.userId,
      milkmanId: actor.tenantId,
      month: targetMonth,
    });

    /*
     * Refuse a payment against a month that owes nothing.
     *
     * `balancePaise` counts only VERIFIED payments, so it alone would let a
     * customer record the same bill twice while the milkman had not yet
     * confirmed the first — two notifications, two rows in the queue, and a
     * bogus credit once both were confirmed. Subtracting what is already
     * awaiting confirmation is what makes the second submission impossible.
     *
     * Enforced here rather than by hiding the form, because a Server Action is
     * a public HTTP endpoint: the form is the courtesy, this is the control.
     */
    const stillDuePaise = Math.max(0, computed.balancePaise - computed.awaitingPaise);

    if (stillDuePaise <= 0) {
      throw new ConflictError(
        computed.awaitingPaise > 0
          ? `You have already recorded ${formatPaise(computed.awaitingPaise)} for ${formatMonth(targetMonth)}. Your milkman is confirming it.`
          : `There is nothing left to pay for ${formatMonth(targetMonth)}.`,
      );
    }

    const payment = await billingRepo.createPayment(tx, {
      billId: bill.id,
      customerId: actor.userId,
      milkmanId: actor.tenantId,
      amount: String(amount),
      method: method ?? 'UPI',
      reference: reference ? String(reference).trim() : null,
      customerNote: note ?? null,
      status: 'SUBMITTED',
    });

    await notificationsRepo.create(tx, {
      userId: actor.tenantId,
      type: 'PAYMENT',
      title: 'Payment to confirm',
      body: `${actor.name} says they paid ${formatPaise(paise)} for ${formatMonth(targetMonth)}${
        reference ? ` · ${reference}` : ''
      }.`,
      href: '/milkman/payments',
      subjectType: 'payment',
      subjectId: payment.id,
    });

    return payment;
  });
}

/** The milkman's verification queue. */
export async function listPending(actor, page) {
  return billingRepo.listSubmitted(actor, page);
}

/**
 * Confirm or reject a payment.
 *
 * `resolvePayment` only transitions rows still in SUBMITTED, so a double-click
 * affects zero rows the second time. `recalculatePaidAmount` then re-derives the
 * bill total from scratch, which makes the whole operation safe to repeat.
 */
export async function verify(actor, { paymentId, approve, rejectionReason }) {
  const payment = await billingRepo.findPayment(actor, paymentId);
  if (!payment) throw new NotFoundError('That payment');
  if (payment.status !== 'SUBMITTED') {
    throw new ConflictError('That payment has already been dealt with.');
  }

  return transaction(async (tx) => {
    const resolved = await billingRepo.resolvePayment(tx, actor, {
      id: paymentId,
      status: approve ? 'VERIFIED' : 'REJECTED',
      rejectionReason: approve ? null : rejectionReason,
    });

    if (!resolved) {
      // Someone else verified it between our read and our write.
      throw new ConflictError('That payment has already been dealt with.');
    }

    const bill = await billingRepo.recalculatePaidAmount(tx, resolved.billId);

    await notificationsRepo.create(tx, {
      userId: resolved.customerId,
      type: 'PAYMENT',
      title: approve ? 'Payment confirmed' : 'Payment not found',
      body: approve
        ? `Your milkman confirmed ${formatPaise(toPaise(resolved.amount))}. Thank you.`
        : `${rejectionReason ?? 'Your milkman could not find this payment.'} Please check the reference and try again.`,
      href: '/billing',
      subjectType: 'payment',
      subjectId: resolved.id,
    });

    return { payment: resolved, bill };
  });
}

/** Outstanding balances across the milkman's book. */
export async function listOutstanding(actor, page) {
  return billingRepo.listOutstanding(actor, page);
}
