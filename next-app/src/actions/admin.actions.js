'use server';

/**
 * Administrator mutations.
 *
 * Every one writes an audit entry inside the same transaction as the change, so
 * a privileged action cannot commit without a record of who made it.
 */

import { defineAction } from './action.js';
import { requireAdmin } from '@/auth/session.js';
import * as V from '@/validation/index.js';

import * as adminService from '@/services/admin.service.js';
import * as saasService from '@/services/saas.service.js';

const verifyMilkmanAction = defineAction({
  authorize: requireAdmin,
  schema: V.verifyMilkmanSchema,
  handler: ({ actor, input }) => adminService.verifyMilkman(actor, input),
  revalidate: ['/admin/milkmen', '/admin'],
});

const suspendMilkmanAction = defineAction({
  authorize: requireAdmin,
  schema: V.suspendMilkmanSchema,
  handler: ({ actor, input }) => adminService.suspendMilkman(actor, input),
  revalidate: ['/admin/milkmen', '/admin'],
});

const verifySaasPaymentAction = defineAction({
  authorize: requireAdmin,
  schema: V.verifySaasPaymentSchema,
  handler: ({ actor, input }) => saasService.verifyPayment(actor, input),
  revalidate: ['/admin/verifications', '/admin/payments', '/admin'],
});

const saveSaasPlanAction = defineAction({
  authorize: requireAdmin,
  schema: V.saasPlanSchema,
  handler: ({ actor, input }) => {
    const { id, ...values } = input;
    return adminService.savePlan(actor, { id, values });
  },
  revalidate: ['/admin/plans', '/pricing'],
});

const retireSaasPlanAction = defineAction({
  authorize: requireAdmin,
  schema: V.idSchema,
  handler: ({ actor, input }) => adminService.retirePlan(actor, input),
  revalidate: ['/admin/plans', '/pricing'],
});

const savePlatformSettingsAction = defineAction({
  authorize: requireAdmin,
  schema: V.platformSettingsSchema,
  handler: ({ actor, input }) => adminService.saveSettings(actor, input),
  revalidate: ['/admin/settings'],
});

/**
 * Exported Server Actions.
 *
 * Next requires every export of a 'use server' module to be a literal async
 * function, so each handler above is wrapped here. The wrapper adds nothing —
 * authorization, validation and error translation all live in `defineAction`.
 */

export async function verifyMilkman(input) {
  return verifyMilkmanAction(input);
}

export async function suspendMilkman(input) {
  return suspendMilkmanAction(input);
}

export async function verifySaasPayment(input) {
  return verifySaasPaymentAction(input);
}

export async function saveSaasPlan(input) {
  return saveSaasPlanAction(input);
}

export async function retireSaasPlan(input) {
  return retireSaasPlanAction(input);
}

export async function savePlatformSettings(input) {
  return savePlatformSettingsAction(input);
}
