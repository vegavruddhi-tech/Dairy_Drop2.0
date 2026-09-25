/**
 * Schema barrel + Drizzle relations.
 *
 * Every table and enum in one import surface, plus the relation graph that lets
 * `db.query.*` build nested reads without hand-written joins.
 */

// The namespace every table below lives in — see _schema.js for why it is
// not `public`.
export * from './_schema.js';

export * from './enums.js';
export * from './identity.js';
export * from './geography.js';
export * from './saas.js';
export * from './milk.js';
export * from './deliveries.js';
export * from './products.js';
export * from './requests.js';
export * from './billing.js';
export * from './notifications.js';

import { relations } from 'drizzle-orm';

import { users, milkmanProfiles, auditLog } from './identity.js';
import { serviceAreas, addresses } from './geography.js';
import { saasPlans, saasSubscriptions, saasPayments } from './saas.js';
import { milkPlans, milkSubscriptions } from './milk.js';
import { deliveries } from './deliveries.js';
import { products, purchases } from './products.js';
import { quantityChangeRequests, planChangeRequests } from './requests.js';
import { monthlyBills, payments } from './billing.js';
import { notifications } from './notifications.js';

export const usersRelations = relations(users, ({ one, many }) => ({
  /** For a CUSTOMER: the milkman who serves them. */
  milkman: one(users, {
    fields: [users.milkmanId],
    references: [users.id],
    relationName: 'tenant',
  }),
  /** For a MILKMAN: their customer book. */
  customers: many(users, { relationName: 'tenant' }),

  profile: one(milkmanProfiles, {
    fields: [users.id],
    references: [milkmanProfiles.milkmanId],
  }),

  addresses: many(addresses),
  serviceAreas: many(serviceAreas),
  notifications: many(notifications),
}));

export const milkmanProfilesRelations = relations(milkmanProfiles, ({ one }) => ({
  milkman: one(users, {
    fields: [milkmanProfiles.milkmanId],
    references: [users.id],
  }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const serviceAreasRelations = relations(serviceAreas, ({ one }) => ({
  milkman: one(users, { fields: [serviceAreas.milkmanId], references: [users.id] }),
}));

export const saasSubscriptionsRelations = relations(saasSubscriptions, ({ one, many }) => ({
  milkman: one(users, { fields: [saasSubscriptions.milkmanId], references: [users.id] }),
  plan: one(saasPlans, { fields: [saasSubscriptions.planId], references: [saasPlans.id] }),
  payments: many(saasPayments),
}));

export const saasPlansRelations = relations(saasPlans, ({ many }) => ({
  subscriptions: many(saasSubscriptions),
}));

export const saasPaymentsRelations = relations(saasPayments, ({ one }) => ({
  milkman: one(users, { fields: [saasPayments.milkmanId], references: [users.id] }),
  subscription: one(saasSubscriptions, {
    fields: [saasPayments.subscriptionId],
    references: [saasSubscriptions.id],
  }),
}));

export const milkPlansRelations = relations(milkPlans, ({ one, many }) => ({
  milkman: one(users, { fields: [milkPlans.milkmanId], references: [users.id] }),
  subscriptions: many(milkSubscriptions),
}));

export const milkSubscriptionsRelations = relations(milkSubscriptions, ({ one }) => ({
  customer: one(users, {
    fields: [milkSubscriptions.customerId],
    references: [users.id],
    relationName: 'subscriptionCustomer',
  }),
  milkman: one(users, {
    fields: [milkSubscriptions.milkmanId],
    references: [users.id],
    relationName: 'subscriptionMilkman',
  }),
  plan: one(milkPlans, {
    fields: [milkSubscriptions.planId],
    references: [milkPlans.id],
  }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  customer: one(users, {
    fields: [deliveries.customerId],
    references: [users.id],
    relationName: 'deliveryCustomer',
  }),
  milkman: one(users, {
    fields: [deliveries.milkmanId],
    references: [users.id],
    relationName: 'deliveryMilkman',
  }),
  subscriptionVersion: one(milkSubscriptions, {
    fields: [deliveries.subscriptionVersionId],
    references: [milkSubscriptions.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  milkman: one(users, { fields: [products.milkmanId], references: [users.id] }),
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  product: one(products, { fields: [purchases.productId], references: [products.id] }),
  customer: one(users, {
    fields: [purchases.customerId],
    references: [users.id],
    relationName: 'purchaseCustomer',
  }),
  milkman: one(users, {
    fields: [purchases.milkmanId],
    references: [users.id],
    relationName: 'purchaseMilkman',
  }),
}));

export const quantityChangeRequestsRelations = relations(
  quantityChangeRequests,
  ({ one }) => ({
    customer: one(users, {
      fields: [quantityChangeRequests.customerId],
      references: [users.id],
      relationName: 'qcrCustomer',
    }),
    milkman: one(users, {
      fields: [quantityChangeRequests.milkmanId],
      references: [users.id],
      relationName: 'qcrMilkman',
    }),
    delivery: one(deliveries, {
      fields: [quantityChangeRequests.deliveryId],
      references: [deliveries.id],
    }),
  }),
);

export const planChangeRequestsRelations = relations(planChangeRequests, ({ one }) => ({
  customer: one(users, {
    fields: [planChangeRequests.customerId],
    references: [users.id],
    relationName: 'pcrCustomer',
  }),
  milkman: one(users, {
    fields: [planChangeRequests.milkmanId],
    references: [users.id],
    relationName: 'pcrMilkman',
  }),
  requestedPlan: one(milkPlans, {
    fields: [planChangeRequests.requestedPlanId],
    references: [milkPlans.id],
  }),
}));

export const monthlyBillsRelations = relations(monthlyBills, ({ one, many }) => ({
  customer: one(users, {
    fields: [monthlyBills.customerId],
    references: [users.id],
    relationName: 'billCustomer',
  }),
  milkman: one(users, {
    fields: [monthlyBills.milkmanId],
    references: [users.id],
    relationName: 'billMilkman',
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  bill: one(monthlyBills, {
    fields: [payments.billId],
    references: [monthlyBills.id],
  }),
  customer: one(users, {
    fields: [payments.customerId],
    references: [users.id],
    relationName: 'paymentCustomer',
  }),
  milkman: one(users, {
    fields: [payments.milkmanId],
    references: [users.id],
    relationName: 'paymentMilkman',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));
