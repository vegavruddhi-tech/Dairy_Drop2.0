/**
 * Postgres enums for every status in the domain.
 *
 * The previous system used free text plus CHECK constraints that had drifted out
 * of sync with the code in four places — writes were being rejected at runtime
 * for values the application considered legal. Real enums make that class of bug
 * impossible: adding a value is a migration, not a guess.
 */

import { pgEnum } from './_schema.js';

/** Who someone is. Mirrors src/auth/roles.js — keep the two in step. */
export const roleEnum = pgEnum('role', ['CUSTOMER', 'MILKMAN', 'ADMIN']);

/** A customer's onboarding state with their milkman. */
export const approvalStatusEnum = pgEnum('approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

/** A milkman's SaaS subscription to the platform. */
export const saasStatusEnum = pgEnum('saas_status', [
  'TRIAL',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
]);

/** A customer's milk subscription. */
export const milkSubscriptionStatusEnum = pgEnum('milk_subscription_status', [
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'SUPERSEDED', // closed because a plan change opened a successor row
]);

/** How often a subscription generates a delivery. Honoured by the generator. */
export const frequencyEnum = pgEnum('frequency', [
  'DAILY',
  'ALTERNATE_DAYS',
  'WEEKLY',
  'MONTHLY',
]);

/** Which round a delivery belongs to. */
export const deliverySlotEnum = pgEnum('delivery_slot', ['MORNING', 'EVENING', 'BOTH']);

/**
 * The lifecycle of one delivery.
 *
 *   PENDING      scheduled, not yet actioned
 *   DELIVERED    handed over — the only status that bills
 *   UNDELIVERED  milkman attended, could not deliver (customer absent)
 *   SKIPPED      planned non-delivery (customer skipped, or milkman day off)
 *   CANCELLED    the subscription ended before this date arrived
 */
export const deliveryStatusEnum = pgEnum('delivery_status', [
  'PENDING',
  'DELIVERED',
  'UNDELIVERED',
  'SKIPPED',
  'CANCELLED',
]);

/** Who or what caused a delivery to be skipped — drives reporting. */
export const skipReasonEnum = pgEnum('skip_reason', [
  'CUSTOMER_REQUEST',
  'MILKMAN_DAY_OFF',
  'CUSTOMER_ABSENT',
  'OUT_OF_STOCK',
  'OTHER',
]);

/** A customer's order for an extra product. */
export const purchaseStatusEnum = pgEnum('purchase_status', [
  'PENDING',
  'ACCEPTED',
  'DELIVERED',
  'CANCELLED',
]);

/** A customer→milkman payment. Clean, minimal, unambiguous. */
export const paymentStatusEnum = pgEnum('payment_status', [
  'SUBMITTED', // customer says they have paid; awaiting the milkman
  'VERIFIED',  // milkman confirmed receipt — counts against the bill
  'REJECTED',  // milkman could not find the money
  'REFUNDED',
]);

export const paymentMethodEnum = pgEnum('payment_method', ['UPI', 'CASH', 'BANK_TRANSFER']);

/** A monthly bill's settlement state. Derived, never hand-set. */
export const billStatusEnum = pgEnum('bill_status', [
  'OPEN',           // the month is still running
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
]);

/** Customer-initiated requests that need a milkman decision. */
export const requestStatusEnum = pgEnum('request_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
]);

/** Categories for in-app notifications. Drives the icon and the deep link. */
export const notificationTypeEnum = pgEnum('notification_type', [
  'DELIVERY',
  'ORDER',
  'PAYMENT',
  'APPROVAL',
  'PLAN_CHANGE',
  'QUANTITY_CHANGE',
  'SUBSCRIPTION',
  'BROADCAST',
  'SYSTEM',
]);

/** Privileged actions worth keeping a permanent record of. */
export const auditActionEnum = pgEnum('audit_action', [
  'MILKMAN_VERIFIED',
  'MILKMAN_SUSPENDED',
  'SAAS_PAYMENT_VERIFIED',
  'SAAS_PAYMENT_REJECTED',
  'SAAS_PLAN_CREATED',
  'SAAS_PLAN_UPDATED',
  'SAAS_PLAN_DELETED',
  'PLATFORM_SETTINGS_UPDATED',
  'CUSTOMER_APPROVED',
  'CUSTOMER_REJECTED',
  'ROLE_GRANTED',
]);
