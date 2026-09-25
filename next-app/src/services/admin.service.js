/**
 * Platform administration.
 */

import 'server-only';
import { eq, and, gte, sql, desc, inArray } from 'drizzle-orm';

import { db, transaction } from '@/db/index.js';
import {
  milkmanProfiles,
  saasSubscriptions,
  saasPayments,
  saasPlans,
  platformSettings,
  auditLog,
  users,
  deliveries,
} from '@/db/schema/index.js';
import { businessDate, businessMonth, monthStart } from '@/domain/dates.js';
import { NotFoundError, ValidationError } from '@/domain/errors.js';

import * as usersRepo from '@/repositories/users.repo.js';
import * as saasRepo from '@/repositories/saas.repo.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';
import * as auditService from './audit.service.js';

/** Platform KPIs for the admin dashboard. All aggregation in SQL. */
export async function getDashboard() {
  const month = businessMonth();

  const [counts, revenue, pending] = await Promise.all([
    usersRepo.platformCounts().catch(() => ({ milkmen: 0, customers: 0, approvedCustomers: 0, pendingCustomers: 0 })),
    db
      .select({
        monthPaise: sql`coalesce(sum(${saasPayments.amount}) filter (
          where ${saasPayments.status} = 'VERIFIED'
            and ${saasPayments.verifiedAt} >= ${monthStart(month)}::date
        ), 0)`,
        allTimePaise: sql`coalesce(sum(${saasPayments.amount}) filter (
          where ${saasPayments.status} = 'VERIFIED'
        ), 0)`,
        pendingCount: sql`count(*) filter (where ${saasPayments.status} = 'SUBMITTED')::int`,
      })
      .from(saasPayments)
      .catch(() => [{ monthPaise: 0, allTimePaise: 0, pendingCount: 0 }]),
    db
      .select({
        active: sql`count(*) filter (where ${saasSubscriptions.status} = 'ACTIVE')::int`,
        trial: sql`count(*) filter (where ${saasSubscriptions.status} = 'TRIAL')::int`,
        awaiting: sql`count(*) filter (where ${saasSubscriptions.status} = 'PENDING_VERIFICATION')::int`,
        expired: sql`count(*) filter (where ${saasSubscriptions.status} = 'EXPIRED')::int`,
      })
      .from(saasSubscriptions)
      .catch(() => [{ active: 0, trial: 0, awaiting: 0, expired: 0 }]),
  ]);

  const [unverified] = await db
    .select({ count: sql`count(*) filter (where ${milkmanProfiles.isVerified} = false)::int` })
    .from(milkmanProfiles)
    .catch(() => [{ count: 0 }]);

  const subs = pending?.[0] ?? { active: 0, trial: 0, awaiting: 0, expired: 0 };
  const rev = revenue?.[0] ?? { monthPaise: 0, allTimePaise: 0, pendingCount: 0 };

  return {
    month,
    milkmen: counts?.milkmen ?? 0,
    customers: counts?.customers ?? 0,
    approvedCustomers: counts?.approvedCustomers ?? 0,
    pendingCustomers: counts?.pendingCustomers ?? 0,
    unverifiedMilkmen: unverified?.count ?? 0,
    subscriptions: {
      active: subs.active ?? 0,
      trial: subs.trial ?? 0,
      awaiting: subs.awaiting ?? 0,
      expired: subs.expired ?? 0,
    },
    revenueMonthPaise: Math.round(Number(rev.monthPaise ?? 0) * 100),
    revenueAllTimePaise: Math.round(Number(rev.allTimePaise ?? 0) * 100),
    paymentsAwaiting: rev.pendingCount ?? 0,
  };
}

/** Plan distribution — reads the right table, unlike the previous implementation. */
export async function getPlanDistribution() {
  try {
    const rows = await db
      .select({
        planId: saasPlans.id,
        planName: sql`coalesce(${saasPlans.name}, 'Free trial')`.as('plan_name'),
        count: sql`count(${saasSubscriptions.id})::int`,
        monthlyPrice: saasPlans.monthlyPrice,
      })
      .from(saasSubscriptions)
      .leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
      .where(inArray(saasSubscriptions.status, ['ACTIVE', 'TRIAL']))
      .groupBy(saasPlans.id, saasPlans.name, saasPlans.monthlyPrice)
      .orderBy(desc(sql`count(${saasSubscriptions.id})`));

    return rows.map((r) => ({
      planId: r.planId,
      planName: r.planName || 'Free trial',
      count: Number(r.count || 0),
      monthlyPrice: r.monthlyPrice ? Number(r.monthlyPrice) : null,
    }));
  } catch (err) {
    console.error('[getPlanDistribution] Error:', err);
    return [];
  }
}

export async function listMilkmen(options) {
  return usersRepo.listMilkmen(options);
}

export async function getMilkman(milkmanId) {
  const profile = await usersRepo.findMilkmanProfile(milkmanId);
  if (!profile) throw new NotFoundError('That milkman');

  const [subscription, history, areas] = await Promise.all([
    saasRepo.findCurrentSaasSubscription(milkmanId),
    saasRepo.listSaasSubscriptions(milkmanId),
    usersRepo.listServiceAreas(milkmanId),
  ]);

  return { profile, subscription, history, areas };
}

/** Verify a business. Opens the panel, subject to the subscription gate. */
export async function verifyMilkman(actor, { milkmanId }) {
  return transaction(async (tx) => {
    const [row] = await tx
      .update(milkmanProfiles)
      .set({
        isVerified: true,
        verifiedBy: actor.userId,
        verifiedAt: new Date(),
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(milkmanProfiles.milkmanId, milkmanId))
      .returning();

    if (!row) throw new NotFoundError('That milkman');

    await notificationsRepo.create(tx, {
      userId: milkmanId,
      type: 'APPROVAL',
      title: 'Your business is verified',
      body: 'You can start your free trial or choose a plan.',
      href: '/milkman/activate',
    });

    await auditService.record(tx, actor, {
      action: 'MILKMAN_VERIFIED',
      subjectType: 'milkman_profile',
      subjectId: milkmanId,
    });

    return row;
  });
}

/**
 * Suspend a business.
 *
 * Destructive: it closes the panel for the milkman **and** stops their
 * customers' deliveries. Requires a reason, which is shown to the milkman and
 * recorded in the audit log. Unlike the previous implementation this does not
 * cancel the subscription, so verifying again fully restores access.
 */
export async function suspendMilkman(actor, { milkmanId, reason }) {
  if (!String(reason ?? '').trim()) {
    throw new ValidationError('Give a reason — the milkman will see it.');
  }

  return transaction(async (tx) => {
    const [row] = await tx
      .update(milkmanProfiles)
      .set({
        isVerified: false,
        suspendedAt: new Date(),
        suspensionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(milkmanProfiles.milkmanId, milkmanId))
      .returning();

    if (!row) throw new NotFoundError('That milkman');

    // 1. Cancel all future pending deliveries for this milkman
    const today = businessDate();
    await tx
      .update(deliveries)
      .set({
        status: 'CANCELLED',
        skipReason: 'MILKMAN_SUSPENDED',
        note: `Dairy operations suspended by platform: ${reason}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deliveries.milkmanId, milkmanId),
          gte(deliveries.deliveryDate, today),
          eq(deliveries.status, 'PENDING'),
        ),
      );

    // 2. Notify the milkman
    await notificationsRepo.create(tx, {
      userId: milkmanId,
      type: 'APPROVAL',
      title: 'Your account has been suspended',
      body: reason,
      href: '/milkman/activate',
    });

    // 3. Notify all active customers of this milkman
    const activeCustomers = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.milkmanId, milkmanId), eq(users.role, 'CUSTOMER')));

    for (const cust of activeCustomers) {
      await notificationsRepo.create(tx, {
        userId: cust.id,
        type: 'DELIVERY',
        title: 'Dairy Provider Service Paused',
        body: 'Your dairy provider service is temporarily suspended. Deliveries are paused. You can switch to another milkman from your profile.',
        href: '/profile',
      });
    }

    // 4. Audit Log
    await auditService.record(tx, actor, {
      action: 'MILKMAN_SUSPENDED',
      subjectType: 'milkman_profile',
      subjectId: milkmanId,
      metadata: { reason, impactedCustomers: activeCustomers.length },
    });

    return row;
  });
}

// ── SaaS plans ───────────────────────────────────────────────────────────────

export async function listPlans() {
  return saasRepo.listAllSaasPlans();
}

export async function savePlan(actor, { id, values }) {
  return transaction(async (tx) => {
    if (id) {
      const [row] = await tx
        .update(saasPlans)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(saasPlans.id, id))
        .returning();
      if (!row) throw new NotFoundError('That plan');

      await auditService.record(tx, actor, {
        action: 'SAAS_PLAN_UPDATED',
        subjectType: 'saas_plan',
        subjectId: id,
        metadata: values,
      });
      return row;
    }

    const [row] = await tx.insert(saasPlans).values(values).returning();
    await auditService.record(tx, actor, {
      action: 'SAAS_PLAN_CREATED',
      subjectType: 'saas_plan',
      subjectId: row.id,
      metadata: values,
    });
    return row;
  });
}

/** Retire a plan. Existing subscribers keep the terms frozen on their row. */
export async function retirePlan(actor, { id }) {
  return savePlan(actor, { id, values: { isActive: false } });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  return saasRepo.getPlatformSettings();
}

export async function saveSettings(actor, values) {
  return transaction(async (tx) => {
    const current = await saasRepo.getPlatformSettings();
    const [row] = await tx
      .update(platformSettings)
      .set({ ...values, updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(platformSettings.id, current.id))
      .returning();

    await auditService.record(tx, actor, {
      action: 'PLATFORM_SETTINGS_UPDATED',
      subjectType: 'platform_settings',
      subjectId: null,
      metadata: values,
    });

    return row;
  });
}

// ── Audit ────────────────────────────────────────────────────────────────────

export async function listAuditLog({ limit = 100, offset = 0 } = {}) {
  return db
    .select({
      id: auditLog.id,
      actorEmail: auditLog.actorEmail,
      action: auditLog.action,
      subjectType: auditLog.subjectType,
      subjectId: auditLog.subjectId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

export async function listVerifications() {
  return saasRepo.listPendingVerifications();
}

export async function listPayments(page) {
  return saasRepo.listSaasPayments(page);
}
