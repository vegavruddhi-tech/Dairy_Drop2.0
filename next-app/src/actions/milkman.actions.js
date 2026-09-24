'use server';

/**
 * Milkman mutations.
 *
 * `requireMilkman` enforces verification **and** the SaaS paywall on every call.
 * That is the server-side control the previous system never mounted.
 *
 * The activation-screen actions pass `allowUnpaid`, because a milkman who cannot
 * pay must still be able to start a trial or submit a payment.
 */

import { defineAction } from './action.js';
import { requireMilkman } from '@/auth/session.js';
import * as V from '@/validation/index.js';

import * as deliveryService from '@/services/delivery.service.js';
import * as onboardingService from '@/services/onboarding.service.js';
import * as productService from '@/services/product.service.js';
import * as paymentService from '@/services/payment.service.js';
import * as requestService from '@/services/request.service.js';
import * as saasService from '@/services/saas.service.js';
import * as subscriptionService from '@/services/subscription.service.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import { transaction } from '@/db/index.js';
import { resolveUnitPrice } from '@/domain/pricing.js';
import { businessMonth } from '@/domain/dates.js';

const paid = (options) => requireMilkman(options);
const unpaid = (options) => requireMilkman({ ...options, allowUnpaid: true });

// ── The round ────────────────────────────────────────────────────────────────

const markDeliveryAction = defineAction({
  authorize: paid,
  schema: V.markDeliverySchema,
  handler: ({ actor, input }) => deliveryService.markDelivery(actor, input),
  revalidate: ['/milkman/round', '/milkman'],
});

const declareDayOffAction = defineAction({
  authorize: paid,
  schema: V.dayOffSchema,
  handler: ({ actor, input }) => deliveryService.declareDayOff(actor, input),
  revalidate: ['/milkman/round', '/milkman'],
});

const cancelDayOffAction = defineAction({
  authorize: paid,
  schema: V.cancelHolidaySchema,
  handler: ({ actor, input }) => deliveryService.cancelDayOff(actor, input),
  revalidate: ['/milkman/round', '/milkman'],
});

// ── Customers ────────────────────────────────────────────────────────────────

const approveCustomerAction = defineAction({
  authorize: paid,
  schema: V.approveCustomerSchema,
  handler: ({ actor, input }) => onboardingService.approveCustomer(actor, input),
  revalidate: ['/milkman/customers', '/milkman'],
});

const rejectCustomerAction = defineAction({
  authorize: paid,
  schema: V.rejectCustomerSchema,
  handler: ({ actor, input }) => onboardingService.rejectCustomer(actor, input),
  revalidate: ['/milkman/customers', '/milkman'],
});

const updateCustomerAddressAction = defineAction({
  authorize: paid,
  schema: V.updateCustomerAddressSchema,
  handler: ({ actor, input }) => onboardingService.updateCustomerAddress(actor, input),
  revalidate: ['/milkman/customers', '/milkman', '/milkman/round'],
});

// ── Plans ────────────────────────────────────────────────────────────────────

const saveMilkPlanAction = defineAction({
  authorize: paid,
  schema: V.milkPlanSchema,
  handler: async ({ actor, input }) => {
    const { id, ...values } = input;
    const month = businessMonth();
    // Fail here, at the boundary, rather than when a customer first subscribes.
    resolveUnitPrice(values, month);

    return transaction(async (tx) =>
      id
        ? subscriptionsRepo.updatePlan(tx, actor, { id, patch: values })
        : subscriptionsRepo.createPlan(tx, { milkmanId: actor.userId, ...values }),
    );
  },
  revalidate: ['/milkman/plans'],
});

const retireMilkPlanAction = defineAction({
  authorize: paid,
  schema: V.idSchema,
  handler: ({ actor, input }) => subscriptionService.retirePlan(actor, { planId: input.id }),
  // Ending subscriptions changes the round and the customer list too.
  revalidate: ['/milkman/plans', '/milkman/customers', '/milkman/round', '/milkman'],
});

const deleteMilkPlanAction = defineAction({
  authorize: paid,
  schema: V.idSchema,
  handler: ({ actor, input }) => subscriptionService.deletePlan(actor, { planId: input.id }),
  revalidate: ['/milkman/plans', '/milkman/customers', '/milkman/round', '/milkman'],
});

// ── Catalog ──────────────────────────────────────────────────────────────────

const saveProductAction = defineAction({
  authorize: paid,
  schema: V.productSchema,
  handler: ({ actor, input }) => {
    const { id, ...values } = input;
    return id
      ? productService.updateProduct(actor, { id, patch: values })
      : productService.createProduct(actor, values);
  },
  revalidate: ['/milkman/catalog'],
});

const addCatalogPresetsAction = defineAction({
  authorize: paid,
  handler: ({ actor }) => productService.addPresets(actor),
  revalidate: ['/milkman/catalog'],
});

const deleteProductAction = defineAction({
  authorize: paid,
  schema: V.idSchema,
  handler: ({ actor, input }) => productService.deleteProduct(actor, input),
  revalidate: ['/milkman/catalog'],
});

// ── Delivery Routes / Service Areas ──────────────────────────────────────────

const addServiceAreaAction = defineAction({
  authorize: paid,
  schema: V.serviceAreaSchema,
  handler: async ({ actor, input }) => {
    const { createServiceArea } = await import('@/repositories/users.repo.js');
    return transaction(async (tx) =>
      createServiceArea(tx, {
        milkmanId: actor.userId,
        areaName: input.areaName,
        pincode: input.pincode,
        city: input.city,
        state: input.state,
        routeSequence: input.routeSequence ?? 0,
        isActive: input.isActive ?? true,
      }),
    );
  },
  revalidate: ['/milkman/routes', '/milkman/round', '/milkman'],
});

const deleteServiceAreaAction = defineAction({
  authorize: paid,
  schema: V.idSchema,
  handler: async ({ actor, input }) => {
    const { deleteServiceArea } = await import('@/repositories/users.repo.js');
    return transaction(async (tx) => deleteServiceArea(tx, actor, input.id));
  },
  revalidate: ['/milkman/routes', '/milkman/round', '/milkman'],
});

const updateOrderStatusAction = defineAction({
  authorize: paid,
  schema: V.orderStatusSchema,
  handler: ({ actor, input }) => productService.updateOrderStatus(actor, input),
  revalidate: ['/milkman/orders'],
});

// ── Requests ─────────────────────────────────────────────────────────────────

const resolveQuantityRequestAction = defineAction({
  authorize: paid,
  schema: V.resolveRequestSchema,
  handler: ({ actor, input }) => requestService.resolveQuantityRequest(actor, input),
  revalidate: ['/milkman/requests', '/milkman/round'],
});

const resolvePlanChangeRequestAction = defineAction({
  authorize: paid,
  schema: V.resolveRequestSchema,
  handler: ({ actor, input }) => requestService.resolvePlanChangeRequest(actor, input),
  revalidate: ['/milkman/requests', '/milkman/customers'],
});

// ── Payments ─────────────────────────────────────────────────────────────────

const verifyPaymentAction = defineAction({
  authorize: paid,
  schema: V.verifyPaymentSchema,
  handler: ({ actor, input }) => paymentService.verify(actor, input),
  revalidate: ['/milkman/payments', '/milkman/earnings'],
});

// ── Membership (reachable while paywalled) ───────────────────────────────────

const startTrialAction = defineAction({
  authorize: unpaid,
  handler: ({ actor }) => saasService.startTrial(actor),
  revalidate: ['/milkman/activate', '/milkman/membership', '/milkman'],
});

const submitSaasPaymentAction = defineAction({
  authorize: unpaid,
  schema: V.submitSaasPaymentSchema,
  handler: ({ actor, input }) => saasService.submitPayment(actor, input),
  revalidate: ['/milkman/activate', '/milkman/membership'],
});

const cancelSaasSubscriptionAction = defineAction({
  authorize: unpaid,
  handler: ({ actor }) => saasService.cancel(actor),
  revalidate: ['/milkman/membership'],
});

const quickVerifyMyDairyAction = defineAction({
  authorize: unpaid,
  handler: async ({ actor }) => {
    const { verifyMilkman } = await import('@/services/admin.service.js');
    return verifyMilkman(actor, { milkmanId: actor.userId });
  },
  revalidate: ['/milkman/activate', '/milkman'],
});

/**
 * Exported Server Actions.
 *
 * Next requires every export of a 'use server' module to be a literal async
 * function, so each handler above is wrapped here. The wrapper adds nothing —
 * authorization, validation and error translation all live in `defineAction`.
 */

export async function markDelivery(input) {
  return markDeliveryAction(input);
}

export async function declareDayOff(input) {
  return declareDayOffAction(input);
}

export async function cancelDayOff(input) {
  return cancelDayOffAction(input);
}

export async function approveCustomer(input) {
  return approveCustomerAction(input);
}

export async function rejectCustomer(input) {
  return rejectCustomerAction(input);
}

export async function saveMilkPlan(input) {
  return saveMilkPlanAction(input);
}

export async function retireMilkPlan(input) {
  return retireMilkPlanAction(input);
}

export async function deleteMilkPlan(input) {
  return deleteMilkPlanAction(input);
}

export async function saveProduct(input) {
  return saveProductAction(input);
}

export async function deleteProduct(input) {
  return deleteProductAction(input);
}

export async function addCatalogPresets(input) {
  return addCatalogPresetsAction(input);
}

export async function updateOrderStatus(input) {
  return updateOrderStatusAction(input);
}

export async function resolveQuantityRequest(input) {
  return resolveQuantityRequestAction(input);
}

export async function resolvePlanChangeRequest(input) {
  return resolvePlanChangeRequestAction(input);
}

export async function verifyPayment(input) {
  return verifyPaymentAction(input);
}

export async function startTrial(input) {
  return startTrialAction(input);
}

export async function submitSaasPayment(input) {
  return submitSaasPaymentAction(input);
}

export async function cancelSaasSubscription(input) {
  return cancelSaasSubscriptionAction(input);
}

export async function quickVerifyMyDairy(input) {
  return quickVerifyMyDairyAction(input);
}

export async function addServiceArea(input) {
  return addServiceAreaAction(input);
}

export async function deleteServiceArea(input) {
  return deleteServiceAreaAction(input);
}

export async function updateCustomerAddress(input) {
  return updateCustomerAddressAction(input);
}
