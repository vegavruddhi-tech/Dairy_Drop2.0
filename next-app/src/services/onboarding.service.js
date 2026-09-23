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
import { eq, and, sql } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import {
  users, addresses, serviceAreas, milkmanProfiles, milkSubscriptions,
} from '@/db/schema/index.js';
import { businessDate } from '@/domain/dates.js';
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

    available.push({ ...milkman, areas: await usersRepo.listServiceAreas(milkman.id) });
  }

  return { pincode: cleaned, serviceable: available.length > 0, milkmen: available };
}

/**
 * Complete registration: attach the signed-in account to a milkman and an address.
 *
 * The account already exists — Auth.js provisioned it on first Google sign-in
 * with `approvalStatus = 'PENDING'`. This step supplies the details the milkman
 * needs in order to decide.
 */
export async function register(actor, input) {
  if (actor.tenantId) {
    throw new ConflictError('Your account is already registered with a milkman.');
  }

  const milkman = await usersRepo.findMilkmanProfile(input.milkmanId);
  if (!milkman || !milkman.isVerified) {
    throw new NotFoundError('That milkman');
  }

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
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.userId));

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

    await notificationsRepo.create(tx, {
      userId: input.milkmanId,
      type: 'APPROVAL',
      title: 'New customer request',
      body: `${input.name} in ${input.area} would like to start deliveries.`,
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

  return transaction(async (tx) => {
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

    await notificationsRepo.create(tx, {
      userId: customerId,
      type: 'APPROVAL',
      title: 'You are approved',
      body: 'Your milkman has approved you. Choose a plan to start deliveries.',
      href: '/subscriptions',
    });

    await auditService.record(tx, actor, {
      action: 'CUSTOMER_APPROVED',
      subjectType: 'user',
      subjectId: customerId,
      metadata: { customerCountAfter: current + 1, limit },
    });

    return updated;
  });
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
        // The application. An administrator flips this.
        isVerified: false,
      })
      .onConflictDoUpdate({
        target: milkmanProfiles.milkmanId,
        set: {
          businessName: input.businessName,
          businessAddress: input.businessAddress || null,
          upiId: input.upiId || null,
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
