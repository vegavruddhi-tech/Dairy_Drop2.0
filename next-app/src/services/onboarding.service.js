/**
 * Customer onboarding: discovery, registration, approval.
 *
 * The customer-limit check lives here and is used by **both** registration and
 * approval, counting the same thing each time. The previous system had two
 * different checks — registration counted every customer including pending ones
 * and applied only to trials; approval counted approved ones and applied to all
 * plans — so a milkman with five pending signups could not receive a sixth
 * despite having zero approved.
 */

import 'server-only';
import { eq, and, ne, sql } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import {
  users, addresses, serviceAreas, milkmanProfiles, milkSubscriptions, milkPlans,
} from '@/db/schema/index.js';
import { businessDate, businessMonth } from '@/domain/dates.js';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  CustomerLimitReachedError,
} from '@/domain/errors.js';
import { evaluateSaasAccess } from '@/auth/policy.js';
import { ROLES } from '@/auth/roles.js';

import * as usersRepo from '@/repositories/users.repo.js';
import * as saasRepo from '@/repositories/saas.repo.js';
import * as subscriptionsRepo from '@/repositories/subscriptions.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import * as auditService from './audit.service.js';

/** Milkmen serving a pincode. Public — used before anyone signs in. */
export async function findMilkmenForPincode(pincode) {
  const cleaned = String(pincode ?? '').trim();
  if (!/^\d{6}$/.test(cleaned)) {
    throw new ValidationError('Enter a valid 6-digit pincode.');
  }

  const milkmen = await usersRepo.findMilkmenServingPincode(cleaned);

  // Only show milkmen who can actually take the customer on.
  const available = [];
  for (const milkman of milkmen) {
    const saas = await saasRepo.findCurrentSaasSubscription(milkman.id);
    if (!evaluateSaasAccess(saas).ok) continue;

    const count = await subscriptionsRepo.countActiveCustomers(db, milkman.id);
    if (saas.customerLimit && count >= saas.customerLimit) continue;

    const areas = await usersRepo.listServiceAreas(milkman.id);
    const plans = await subscriptionsRepo.listActivePlansForMilkman(milkman.id);

    available.push({ ...milkman, areas, plans });
  }

  return { pincode: cleaned, serviceable: available.length > 0, milkmen: available };
}

/**
 * Complete registration: attach the signed-in account to a milkman and an address,
 * and enroll in up to 2 selected milk plans.
 */
export async function register(actor, input) {
  if (actor.tenantId && actor.approvalStatus !== 'REJECTED') {
    throw new ConflictError('Your account is already registered with an active milkman.');
  }

  const milkman = await usersRepo.findMilkmanProfile(input.milkmanId);
  if (!milkman || !milkman.isVerified) {
    throw new NotFoundError('That milkman');
  }

  // Maximum 2 plans restriction per customer
  const planIds = Array.isArray(input.planIds) ? input.planIds.slice(0, 2) : [];

  let [area] = await db
    .select()
    .from(serviceAreas)
    .where(
      and(
        eq(serviceAreas.milkmanId, input.milkmanId),
        eq(serviceAreas.areaName, input.area),
        eq(serviceAreas.isActive, true),
      ),
    )
    .limit(1);

  if (!area) {
    const [firstArea] = await db
      .select()
      .from(serviceAreas)
      .where(eq(serviceAreas.milkmanId, input.milkmanId))
      .limit(1);

    if (firstArea) {
      area = firstArea;
    } else {
      [area] = await db
        .insert(serviceAreas)
        .values({
          milkmanId: input.milkmanId,
          areaName: input.area,
          pincode: input.pincode,
          city: 'Local Area',
          state: 'State',
          isActive: true,
        })
        .returning();
    }
  }

  await assertCanAcceptCustomer(input.milkmanId);

  return transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        name: input.name,
        phone: input.phone,
        milkmanId: input.milkmanId,
        deliveryArea: input.area,
        approvalStatus: 'PENDING',
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.userId));

    // Reset old addresses default flag
    await tx
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, actor.userId));

    await tx.insert(addresses).values({
      userId: actor.userId,
      recipientName: input.name,
      recipientPhone: input.phone,
      line1: input.line1,
      line2: input.line2 ?? null,
      area: input.area,
      city: area.city,
      state: area.state,
      pincode: input.pincode,
      landmark: input.landmark ?? null,
      deliveryInstructions: input.deliveryInstructions ?? null,
      isDefault: true,
    });

    // Cancel old pending/active subscriptions on re-application
    await tx
      .update(milkSubscriptions)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(milkSubscriptions.customerId, actor.userId),
          ne(milkSubscriptions.status, 'CANCELLED'),
        ),
      );

    // Enrol in the chosen plans (max 2)
    const month = businessMonth();
    const startDate = businessDate();

    for (const planId of planIds) {
      const [plan] = await tx
        .select()
        .from(milkPlans)
        .where(and(eq(milkPlans.id, planId), eq(milkPlans.milkmanId, input.milkmanId)))
        .limit(1);

      if (plan) {
        const { resolveUnitPrice } = await import('@/domain/pricing.js');
        const { toPaise } = await import('@/domain/money.js');
        const { unitPrice } = resolveUnitPrice(plan, month);
        const subId = crypto.randomUUID();

        await tx.insert(milkSubscriptions).values({
          id: subId,
          rootId: subId,
          customerId: actor.userId,
          milkmanId: input.milkmanId,
          planId: plan.id,
          productName: plan.productName,
          quantity: plan.quantity,
          unit: plan.unit,
          frequency: plan.frequency,
          slot: plan.slot,
          morningStart: plan.morningStart,
          morningEnd: plan.morningEnd,
          eveningStart: plan.eveningStart,
          eveningEnd: plan.eveningEnd,
          unitPrice,
          quotedMonthlyPrice: plan.monthlyPrice ? String(plan.monthlyPrice) : null,
          status: 'ACTIVE',
          effectiveFrom: startDate,
        });
      }
    }

    await notificationsRepo.create(tx, {
      userId: input.milkmanId,
      type: 'APPROVAL',
      title: 'New customer request',
      body: `${input.name} in ${input.area} would like to start deliveries${planIds.length > 0 ? ` with ${planIds.length} plan(s)` : ''}.`,
      href: '/milkman/customers?status=PENDING',
      subjectType: 'user',
      subjectId: actor.userId,
    });

    return { ok: true };
  });
}

/**
 * The customer-limit rule, in one place.
 *
 * Counts **approved, active** customers — the ones actually receiving milk —
 * and compares against the ceiling frozen on the milkman's subscription.
 */
export async function assertCanAcceptCustomer(milkmanId, tx = db) {
  const saas = await saasRepo.findCurrentSaasSubscription(milkmanId);
  const access = evaluateSaasAccess(saas);

  if (!access.ok) {
    throw new ConflictError('That milkman is not currently accepting new customers.');
  }

  const limit = saas.customerLimit;
  if (!limit) return { current: 0, limit: null };

  const current = await subscriptionsRepo.countActiveCustomers(tx, milkmanId);
  if (current >= limit) {
    throw new CustomerLimitReachedError({
      current,
      limit,
      planName: saas.planName ?? 'Free trial',
    });
  }

  return { current, limit };
}

/** Approve a pending customer. Re-checks the limit at the moment of approval. */
export async function approveCustomer(actor, { customerId }) {
  const customer = await usersRepo.findCustomer(actor, customerId);
  if (!customer) throw new NotFoundError('That customer');
  if (customer.approvalStatus === 'APPROVED') {
    throw new ConflictError('That customer is already approved.');
  }

  const { current, limit } = await assertCanAcceptCustomer(actor.userId);

  const res = await transaction(async (tx) => {
    const updated = await usersRepo.updateCustomer(tx, actor, {
      customerId,
      patch: {
        approvalStatus: 'APPROVED',
        approvedBy: actor.userId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });
    if (!updated) throw new NotFoundError('That customer');

    const [hasActiveSub] = await tx
      .select({ id: milkSubscriptions.id })
      .from(milkSubscriptions)
      .where(
        and(
          eq(milkSubscriptions.customerId, customerId),
          eq(milkSubscriptions.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    await notificationsRepo.create(tx, {
      userId: customerId,
      type: 'APPROVAL',
      title: 'You are approved',
      body: hasActiveSub
        ? 'Your milkman has approved your subscription. Deliveries will start as scheduled.'
        : 'Your milkman has approved you. Choose a plan to start deliveries.',
      href: hasActiveSub ? '/dashboard' : '/subscriptions',
    });

    await auditService.record(tx, actor, {
      action: 'CUSTOMER_APPROVED',
      subjectType: 'user',
      subjectId: customerId,
      metadata: { customerCountAfter: current + 1, limit },
    });

    return updated;
  });

  try {
    const { generateForDate } = await import('./delivery.service.js');
    await generateForDate(businessDate());
  } catch (err) {
    console.error('Error generating deliveries on customer approval:', err);
  }

  return res;
}

/** Decline a pending customer, with a reason they will see. */
export async function rejectCustomer(actor, { customerId, reason }) {
  const customer = await usersRepo.findCustomer(actor, customerId);
  if (!customer) throw new NotFoundError('That customer');

  return transaction(async (tx) => {
    const updated = await usersRepo.updateCustomer(tx, actor, {
      customerId,
      patch: { approvalStatus: 'REJECTED', rejectionReason: reason ?? null },
    });
    if (!updated) throw new NotFoundError('That customer');

    await tx
      .update(milkSubscriptions)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(milkSubscriptions.customerId, customerId),
          eq(milkSubscriptions.status, 'ACTIVE'),
        ),
      );

    await notificationsRepo.create(tx, {
      userId: customerId,
      type: 'APPROVAL',
      title: 'Registration declined',
      body: reason ?? 'Your milkman could not take you on right now.',
      href: '/pending',
    });

    await auditService.record(tx, actor, {
      action: 'CUSTOMER_REJECTED',
      subjectType: 'user',
      subjectId: customerId,
      metadata: { reason },
    });

    return updated;
  });
}

/**
 * Milkman updates a customer's delivery address & instructions.
 */
export async function updateCustomerAddress(actor, input) {
  const customer = await usersRepo.findCustomer(actor, input.customerId);
  if (!customer) throw new NotFoundError('That customer');

  return transaction(async (tx) => {
    // 1. Update deliveryArea in users table
    await tx
      .update(users)
      .set({
        deliveryArea: input.area,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.customerId));

    // 2. Check if customer already has a default address
    const [existing] = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.userId, input.customerId), eq(addresses.isDefault, true)))
      .limit(1);

    if (existing) {
      await tx
        .update(addresses)
        .set({
          recipientName: customer.name,
          recipientPhone: customer.phone,
          line1: input.line1,
          line2: input.line2 || null,
          area: input.area,
          city: input.city || customer.addressCity || 'Local Area',
          state: input.state || customer.addressState || 'State',
          pincode: input.pincode,
          landmark: input.landmark || null,
          deliveryInstructions: input.deliveryInstructions || null,
          updatedAt: new Date(),
        })
        .where(eq(addresses.id, existing.id));
    } else {
      await tx.insert(addresses).values({
        userId: input.customerId,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        line1: input.line1,
        line2: input.line2 || null,
        area: input.area,
        city: input.city || 'Local Area',
        state: input.state || 'State',
        pincode: input.pincode,
        landmark: input.landmark || null,
        deliveryInstructions: input.deliveryInstructions || null,
        isDefault: true,
      });
    }

    return { ok: true };
  });
}

/**
 * Customer updates their own profile details and delivery address.
 */
export async function updateCustomerProfile(actor, input) {
  return transaction(async (tx) => {
    // 1. Update personal details & delivery area on users table
    await tx
      .update(users)
      .set({
        name: input.name,
        phone: input.phone,
        deliveryArea: input.area,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.userId));

    // 2. Update default address in addresses table
    const [existing] = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.userId, actor.userId), eq(addresses.isDefault, true)))
      .limit(1);

    if (existing) {
      await tx
        .update(addresses)
        .set({
          recipientName: input.name,
          recipientPhone: input.phone,
          line1: input.line1,
          line2: input.line2 || null,
          area: input.area,
          city: input.city || 'City',
          state: input.state || 'State',
          pincode: input.pincode,
          landmark: input.landmark || null,
          deliveryInstructions: input.deliveryInstructions || null,
          updatedAt: new Date(),
        })
        .where(eq(addresses.id, existing.id));
    } else {
      await tx.insert(addresses).values({
        userId: actor.userId,
        recipientName: input.name,
        recipientPhone: input.phone,
        line1: input.line1,
        line2: input.line2 || null,
        area: input.area,
        city: input.city || 'City',
        state: input.state || 'State',
        pincode: input.pincode,
        landmark: input.landmark || null,
        deliveryInstructions: input.deliveryInstructions || null,
        isDefault: true,
      });
    }

    return { ok: true };
  });
}

/**
 * Customer switches to another milkman.
 * Hard Rule: Customer MUST clear all outstanding dues with previous milkman before switching.
 */
export async function switchMilkman(actor, input) {
  // 1. Dues Settlement Check
  if (actor.tenantId) {
    const { getBill } = await import('@/services/billing.service.js');
    const { formatPaise } = await import('@/domain/money.js');
    const currentBill = await getBill(actor, { month: businessMonth() });
    if (currentBill && currentBill.balancePaise > 0) {
      throw new ConflictError(
        `You have an outstanding balance of ${formatPaise(currentBill.balancePaise)} with your current milkman. Please settle all pending dues before switching.`,
      );
    }
  }

  // 2. Validate new milkman
  if (input.newMilkmanId === actor.tenantId) {
    throw new ConflictError('You are already subscribed to this dairy provider.');
  }

  await assertCanAcceptCustomer(input.newMilkmanId);

  const [serviceArea] = await db
    .select()
    .from(serviceAreas)
    .where(
      and(
        eq(serviceAreas.milkmanId, input.newMilkmanId),
        eq(serviceAreas.pincode, input.pincode),
        eq(serviceAreas.isActive, true),
      ),
    )
    .limit(1);

  if (!serviceArea) {
    throw new ConflictError('That dairy provider does not deliver to your pincode.');
  }

  const oldMilkmanId = actor.tenantId;

  return transaction(async (tx) => {
    // 3. Update customer's milkman (milkmanId) and set approval status to PENDING
    await tx
      .update(users)
      .set({
        milkmanId: input.newMilkmanId,
        approvalStatus: 'PENDING',
        deliveryArea: input.area,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.userId));

    // 4. Cancel active subscriptions under the previous milkman
    await tx
      .update(milkSubscriptions)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(milkSubscriptions.customerId, actor.userId),
          ne(milkSubscriptions.status, 'CANCELLED'),
        ),
      );

    // 5. Enrol in new milk plans under the new milkman
    const planIds = Array.isArray(input.planIds) ? input.planIds.slice(0, 2) : [];
    const month = businessMonth();
    const startDate = businessDate();

    for (const planId of planIds) {
      const [plan] = await tx
        .select()
        .from(milkPlans)
        .where(and(eq(milkPlans.id, planId), eq(milkPlans.milkmanId, input.newMilkmanId)))
        .limit(1);

      if (plan) {
        const { resolveUnitPrice } = await import('@/domain/pricing.js');
        const { unitPrice } = resolveUnitPrice(plan, month);
        const subId = crypto.randomUUID();

        await tx.insert(milkSubscriptions).values({
          id: subId,
          rootId: subId,
          customerId: actor.userId,
          milkmanId: input.newMilkmanId,
          planId: plan.id,
          productName: plan.productName,
          quantity: plan.quantity,
          unit: plan.unit,
          frequency: plan.frequency,
          slot: plan.slot,
          morningStart: plan.morningStart,
          morningEnd: plan.morningEnd,
          eveningStart: plan.eveningStart,
          eveningEnd: plan.eveningEnd,
          unitPrice,
          quotedMonthlyPrice: plan.monthlyPrice ? String(plan.monthlyPrice) : null,
          status: 'ACTIVE',
          effectiveFrom: startDate,
        });
      }
    }

    // 6. Notify the new milkman
    await notificationsRepo.create(tx, {
      userId: input.newMilkmanId,
      type: 'APPROVAL',
      title: 'New customer transfer request',
      body: `${actor.name || 'A customer'} in ${input.area} has switched to your dairy and requested daily delivery.`,
      href: '/milkman/customers?status=PENDING',
      subjectType: 'user',
      subjectId: actor.userId,
    });

    // 7. Notify previous milkman
    if (oldMilkmanId) {
      await notificationsRepo.create(tx, {
        userId: oldMilkmanId,
        type: 'CUSTOMER_REMOVED',
        title: 'Customer transferred out',
        body: `${actor.name || 'A customer'} in ${input.area} has cleared all dues and switched to another dairy provider.`,
        href: '/milkman/customers',
        subjectType: 'user',
        subjectId: actor.userId,
      });
    }

    return { ok: true };
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Becoming a milkman
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply to trade on the platform as a milkman.
 *
 * Anyone with an account can apply. The application *is* the milkman profile —
 * created with `isVerified: false`, which the existing access gate already
 * understands: the applicant's role flips to MILKMAN immediately but every
 * milkman route redirects them to `/milkman/activate` until an administrator
 * verifies the business.
 *
 * That reuse is deliberate. A separate "applications" table would duplicate the
 * verification state that `milkman_profiles.isVerified` already holds, and give
 * two places to ask "is this business approved?".
 */
export async function applyToBecomeMilkman(actor, input) {
  if (actor.role === ROLES.MILKMAN) {
    throw new ConflictError('You have already applied. Check your application status.');
  }
  if (actor.role === ROLES.ADMIN) {
    throw new ConflictError('An administrator account cannot also trade as a milkman.');
  }

  // Switching role would orphan an existing customer's deliveries and bills.
  const [activeSubscription] = await db
    .select({ id: milkSubscriptions.id })
    .from(milkSubscriptions)
    .where(
      and(
        eq(milkSubscriptions.customerId, actor.userId),
        eq(milkSubscriptions.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (activeSubscription) {
    throw new ConflictError(
      'Cancel your own milk subscription before applying — one account cannot both buy and sell.',
    );
  }

  return transaction(async (tx) => {
    // Promote the account and clear the customer-side fields, which no longer
    // apply. Their tenant is now themselves.
    await tx
      .update(users)
      .set({
        role: ROLES.MILKMAN,
        phone: input.phone,
        milkmanId: null,
        approvalStatus: null,
        deliveryArea: null,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.userId));

    const [profile] = await tx
      .insert(milkmanProfiles)
      .values({
        milkmanId: actor.userId,
        businessName: input.businessName,
        businessAddress: input.businessAddress || null,
        upiId: input.upiId || null,
        qrCodeUrl: input.qrCodeUrl || null,
        // The application. An administrator flips this.
        isVerified: false,
      })
      .onConflictDoUpdate({
        target: milkmanProfiles.milkmanId,
        set: {
          businessName: input.businessName,
          businessAddress: input.businessAddress || null,
          upiId: input.upiId || null,
          qrCodeUrl: input.qrCodeUrl || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // A milkman with no coverage cannot be found by any customer, so the first
    // area is captured with the application rather than left until later.
    await tx
      .insert(serviceAreas)
      .values({
        milkmanId: actor.userId,
        areaName: input.areaName,
        pincode: input.pincode,
        city: input.city,
        state: input.state,
        isActive: true,
      })
      .onConflictDoNothing();

    // Put it in front of every administrator.
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, ROLES.ADMIN));

    await notificationsRepo.create(
      tx,
      admins.map((admin) => ({
        userId: admin.id,
        type: 'APPROVAL',
        title: 'New milkman application',
        body: `${input.businessName} (${input.areaName}, ${input.pincode}) is waiting for verification.`,
        href: '/admin/milkmen?tab=unverified',
        subjectType: 'milkman_profile',
        subjectId: actor.userId,
      })),
    );

    await notificationsRepo.create(tx, {
      userId: actor.userId,
      type: 'APPROVAL',
      title: 'Application received',
      body: 'We are checking your details. You will be able to open your panel once verified.',
      href: '/milkman/activate',
    });

    return profile;
  });
}

/** How many businesses are waiting on verification. Drives the admin badge. */
export async function countPendingMilkmanApplications() {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(milkmanProfiles)
    .where(eq(milkmanProfiles.isVerified, false));
  return row?.count ?? 0;
}

/** Update milkman's customer-facing UPI ID and QR code image */
export async function updateMilkmanPaymentSettings(actor, input) {
  const profile = await usersRepo.updateMilkmanPaymentDetails(db, actor.userId, {
    upiId: input.upiId || null,
    qrCodeUrl: input.qrCodeUrl || null,
  });
  return profile;
}


