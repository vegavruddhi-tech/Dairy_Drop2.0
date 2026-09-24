'use server';

/**
 * Customer mutations.
 *
 * Every one is guarded by `requireCustomer`, which enforces the role *and* the
 * approval gate. A pending or rejected customer cannot mutate anything.
 */

import { defineAction } from './action.js';
import { requireCustomer } from '@/auth/session.js';
import * as V from '@/validation/index.js';

import * as subscriptionService from '@/services/subscription.service.js';
import * as deliveryService from '@/services/delivery.service.js';
import * as productService from '@/services/product.service.js';
import * as paymentService from '@/services/payment.service.js';
import * as requestService from '@/services/request.service.js';
import * as onboardingService from '@/services/onboarding.service.js';

// ── Subscriptions ────────────────────────────────────────────────────────────

const subscribeAction = defineAction({
  authorize: requireCustomer,
  schema: V.subscribeSchema,
  handler: ({ actor, input }) => subscriptionService.subscribe(actor, input),
  revalidate: ['/subscriptions', '/dashboard', '/pending', '/milkman/customers'],
});

const pauseSubscriptionAction = defineAction({
  authorize: requireCustomer,
  schema: V.subscriptionActionSchema,
  handler: ({ actor, input }) => subscriptionService.pause(actor, input),
  revalidate: ['/subscriptions', '/dashboard'],
});

const resumeSubscriptionAction = defineAction({
  authorize: requireCustomer,
  schema: V.subscriptionActionSchema,
  handler: ({ actor, input }) => subscriptionService.resume(actor, input),
  revalidate: ['/subscriptions', '/dashboard'],
});

const cancelSubscriptionAction = defineAction({
  authorize: requireCustomer,
  schema: V.subscriptionActionSchema,
  handler: ({ actor, input }) => subscriptionService.cancel(actor, input),
  revalidate: ['/subscriptions', '/dashboard'],
});

// ── Deliveries ───────────────────────────────────────────────────────────────

const skipDayAction = defineAction({
  authorize: requireCustomer,
  schema: V.skipDaySchema,
  handler: ({ actor, input }) => deliveryService.skipDay(actor, input),
  revalidate: ['/dashboard', '/calendar'],
});

const resumeDayAction = defineAction({
  authorize: requireCustomer,
  schema: V.skipDaySchema.pick({ deliveryId: true }),
  handler: ({ actor, input }) => deliveryService.resumeDay(actor, input),
  revalidate: ['/dashboard', '/calendar'],
});

/**
 * Change one day's quantity.
 *
 * Applies immediately and writes only that delivery row — a one-day change is a
 * one-day change. The milkman is told, not asked.
 */
const adjustQuantityAction = defineAction({
  authorize: requireCustomer,
  schema: V.adjustQuantitySchema,
  handler: ({ actor, input }) => deliveryService.adjustQuantity(actor, input),
  revalidate: ['/dashboard', '/calendar'],
});

const setVacationAction = defineAction({
  authorize: requireCustomer,
  schema: V.vacationSchema,
  handler: ({ actor, input }) => deliveryService.setVacationRange(actor, input),
  revalidate: ['/dashboard', '/calendar'],
});

const cancelVacationAction = defineAction({
  authorize: requireCustomer,
  schema: V.cancelVacationSchema,
  handler: ({ actor, input }) => deliveryService.cancelVacation(actor, input),
  revalidate: ['/dashboard', '/calendar'],
});

// ── Requests ─────────────────────────────────────────────────────────────────

const requestPlanChangeAction = defineAction({
  authorize: requireCustomer,
  schema: V.planChangeRequestSchema,
  handler: ({ actor, input }) => requestService.requestPlanChange(actor, input),
  revalidate: ['/subscriptions'],
});

// ── Shop ─────────────────────────────────────────────────────────────────────

const orderProductAction = defineAction({
  authorize: requireCustomer,
  schema: V.orderSchema,
  handler: ({ actor, input }) => productService.order(actor, input),
  revalidate: ['/shop', '/billing', '/dashboard'],
});

// ── Payments ─────────────────────────────────────────────────────────────────

const submitPaymentAction = defineAction({
  authorize: requireCustomer,
  schema: V.submitPaymentSchema,
  handler: ({ actor, input }) => paymentService.submit(actor, input),
  revalidate: ['/billing'],
});

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Complete registration. Guarded by role only — a customer who has not yet
 * chosen a milkman is by definition not approved, so `requireCustomer` would
 * lock them out of the very screen that fixes it.
 */
const registerWithMilkmanAction = defineAction({
  authorize: async () => {
    const { requireRole, ROLES } = await import('@/auth/session.js');
    return requireRole(ROLES.CUSTOMER);
  },
  schema: V.registerCustomerSchema,
  handler: ({ actor, input }) => onboardingService.register(actor, input),
  revalidate: ['/pending', '/dashboard'],
});

/**
 * Apply to trade as a milkman.
 *
 * Signed-in is the only guard, deliberately. `requireCustomer` would refuse a
 * PENDING customer the one screen that fixes their state, and narrowing to
 * CUSTOMER would turn "you have already applied" into a blank Forbidden. The
 * service already rejects the cases that matter — an existing milkman, an
 * administrator, or a customer with a live subscription — with a message the
 * form can actually show.
 *
 * `options` is passed through so the guard throws in action mode rather than
 * redirecting; a mutation's refusal is an error the caller must see.
 */
const applyToBecomeMilkmanAction = defineAction({
  authorize: async (options) => {
    const { requireActor } = await import('@/auth/session.js');
    return requireActor(options);
  },
  schema: V.milkmanApplicationSchema,
  handler: ({ actor, input }) => onboardingService.applyToBecomeMilkman(actor, input),
  // The applicant's role changed and an application is now waiting on an
  // administrator, so both sides of the screen are stale.
  revalidate: ['/milkman/activate', '/dashboard', '/admin', '/admin/milkmen'],
});

const quickApproveCustomerAction = defineAction({
  authorize: async () => {
    const { requireActor } = await import('@/auth/session.js');
    return requireActor();
  },
  handler: async ({ actor }) => {
    const { db } = await import('@/db/index.js');
    const { users } = await import('@/db/schema/index.js');
    const { eq } = await import('drizzle-orm');
    await db
      .update(users)
      .set({
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: actor.tenantId ?? actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.userId));
    return { ok: true };
  },
  revalidate: ['/pending', '/dashboard'],
});

/**
 * Step off a retired plan onto one still on offer.
 *
 * Role-only guard for the same reason as registration: the customer is not
 * changing anything they need approval for, they are escaping a plan that was
 * withdrawn from under them. The service refuses unless it really was.
 */
const switchFromRetiredPlanAction = defineAction({
  authorize: async (options) => {
    const { requireRole, ROLES } = await import('@/auth/session.js');
    return requireRole(ROLES.CUSTOMER, options);
  },
  schema: V.switchRetiredSchema,
  handler: ({ actor, input }) => subscriptionService.switchFromRetiredPlan(actor, input),
  revalidate: ['/subscriptions', '/dashboard', '/calendar'],
});

/**
 * Exported Server Actions.
 *
 * Next requires every export of a 'use server' module to be a literal async
 * function, so each handler above is wrapped here. The wrapper adds nothing —
 * authorization, validation and error translation all live in `defineAction`.
 */

export async function subscribe(input) {
  return subscribeAction(input);
}

export async function pauseSubscription(input) {
  return pauseSubscriptionAction(input);
}

export async function resumeSubscription(input) {
  return resumeSubscriptionAction(input);
}

export async function cancelSubscription(input) {
  return cancelSubscriptionAction(input);
}

export async function skipDay(input) {
  return skipDayAction(input);
}

export async function resumeDay(input) {
  return resumeDayAction(input);
}

export async function adjustQuantity(input) {
  return adjustQuantityAction(input);
}

export async function requestPlanChange(input) {
  return requestPlanChangeAction(input);
}

export async function orderProduct(input) {
  return orderProductAction(input);
}

export async function submitPayment(input) {
  return submitPaymentAction(input);
}

export async function registerWithMilkman(input) {
  return registerWithMilkmanAction(input);
}

export async function applyToBecomeMilkman(input) {
  return applyToBecomeMilkmanAction(input);
}

export async function switchFromRetiredPlan(input) {
  return switchFromRetiredPlanAction(input);
}

export async function setVacation(input) {
  return setVacationAction(input);
}

export async function cancelVacation(input) {
  return cancelVacationAction(input);
}

export async function quickApproveCustomer(input) {
  return quickApproveCustomerAction(input);
}
