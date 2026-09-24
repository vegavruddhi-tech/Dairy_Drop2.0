/**
 * SaaS layer data access: platform plans, milkman subscriptions, platform payments.
 */

import 'server-only';
import { and, eq, desc, inArray, lt, sql } from 'drizzle-orm';

import { db } from '@/db/index.js';
import {
  saasPlans,
  saasSubscriptions,
  saasPayments,
  platformSettings,
  users,
  milkmanProfiles,
} from '@/db/schema/index.js';

/** Statuses that represent a live (or pending) enrolment. */
const LIVE_STATUSES = ['TRIAL', 'ACTIVE', 'PENDING_VERIFICATION'];

/**
 * The milkman's current subscription, or null.
 *
 * A partial unique index guarantees at most one live row (ACTIVE or TRIAL),
 * and at most one PENDING_VERIFICATION beside it. The live one wins: a
 * milkman changing plans stays on the old plan until the new one is verified.
 * With no live row, the pending one is returned so the gate can say so.
 */
export async function findCurrentSaasSubscription(milkmanId) {
  const [row] = await db
    .select({
      id: saasSubscriptions.id,
      milkmanId: saasSubscriptions.milkmanId,
      planId: saasSubscriptions.planId,
      status: saasSubscriptions.status,
      startsAt: saasSubscriptions.startsAt,
      endsAt: saasSubscriptions.endsAt,
      customerLimit: saasSubscriptions.customerLimit,
      pricePaid: saasSubscriptions.pricePaid,
      paymentReference: saasSubscriptions.paymentReference,
      planName: saasPlans.name,
      planMaxCustomers: saasPlans.maxCustomers,
      planMonthlyPrice: saasPlans.monthlyPrice,
    })
    .from(saasSubscriptions)
    .leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(
      and(
        eq(saasSubscriptions.milkmanId, milkmanId),
        inArray(saasSubscriptions.status, LIVE_STATUSES),
      ),
    )
    .orderBy(sql`case ${saasSubscriptions.status} when 'ACTIVE' then 0 when 'TRIAL' then 1 else 2 end`)
    .limit(1);

  return row ?? null;
}

/** The payment this milkman has in the verification queue, if any. */
export async function findPendingSaasSubscription(milkmanId) {
  const [row] = await db
    .select({
      id: saasSubscriptions.id,
      planId: saasSubscriptions.planId,
      status: saasSubscriptions.status,
      customerLimit: saasSubscriptions.customerLimit,
      pricePaid: saasSubscriptions.pricePaid,
      paymentReference: saasSubscriptions.paymentReference,
      createdAt: saasSubscriptions.createdAt,
      planName: saasPlans.name,
      planMaxCustomers: saasPlans.maxCustomers,
    })
    .from(saasSubscriptions)
    .leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(
      and(
        eq(saasSubscriptions.milkmanId, milkmanId),
        eq(saasSubscriptions.status, 'PENDING_VERIFICATION'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Full history, newest first — shown on the milkman's membership screen. */
export async function listSaasSubscriptions(milkmanId) {
  return db
    .select({
      id: saasSubscriptions.id,
      status: saasSubscriptions.status,
      startsAt: saasSubscriptions.startsAt,
      endsAt: saasSubscriptions.endsAt,
      pricePaid: saasSubscriptions.pricePaid,
      cancellationReason: saasSubscriptions.cancellationReason,
      paymentReference: saasSubscriptions.paymentReference,
      planName: saasPlans.name,
      createdAt: saasSubscriptions.createdAt,
    })
    .from(saasSubscriptions)
    .leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(eq(saasSubscriptions.milkmanId, milkmanId))
    .orderBy(desc(saasSubscriptions.createdAt));
}

/** Has this milkman ever taken a trial? One per account, ever. */
export async function hasUsedTrial(milkmanId) {
  const [row] = await db
    .select({ id: saasSubscriptions.id })
    .from(saasSubscriptions)
    .where(
      and(eq(saasSubscriptions.milkmanId, milkmanId), eq(saasSubscriptions.status, 'TRIAL')),
    )
    .limit(1);

  if (row) return true;

  // A trial that has since expired or been cancelled still counts.
  const [historic] = await db
    .select({ id: saasSubscriptions.id })
    .from(saasSubscriptions)
    .where(
      and(
        eq(saasSubscriptions.milkmanId, milkmanId),
        sql`${saasSubscriptions.planId} is null`,
      ),
    )
    .limit(1);

  return Boolean(historic);
}

/** Plans on sale, cheapest first. */
export async function listActiveSaasPlans() {
  return db
    .select()
    .from(saasPlans)
    .where(eq(saasPlans.isActive, true))
    .orderBy(saasPlans.sortOrder, saasPlans.monthlyPrice);
}

export async function findSaasPlan(planId) {
  const [row] = await db.select().from(saasPlans).where(eq(saasPlans.id, planId)).limit(1);
  return row ?? null;
}

/** Every plan, including retired ones — admin view. */
export async function listAllSaasPlans() {
  return db.select().from(saasPlans).orderBy(saasPlans.sortOrder, saasPlans.monthlyPrice);
}

/** Subscriptions awaiting a manual payment check. The admin's work queue. */
export async function listPendingVerifications() {
  return db
    .select({
      id: saasSubscriptions.id,
      milkmanId: saasSubscriptions.milkmanId,
      milkmanName: users.name,
      milkmanEmail: users.email,
      milkmanPhone: users.phone,
      businessName: milkmanProfiles.businessName,
      planName: saasPlans.name,
      amount: saasPlans.monthlyPrice,
      reference: saasSubscriptions.paymentReference,
      submittedAt: saasSubscriptions.createdAt,
      /** The plan they are on right now, when this payment is a change rather than a first purchase. */
      changingFrom: sql`(
        select coalesce(p.name, 'Free trial')
        from ${saasSubscriptions} s
        left join ${saasPlans} p on p.id = s.plan_id
        where s.milkman_id = ${saasSubscriptions.milkmanId}
          and s.status in ('ACTIVE', 'TRIAL')
        limit 1
      )`.as('changing_from'),
    })
    .from(saasSubscriptions)
    .innerJoin(users, eq(users.id, saasSubscriptions.milkmanId))
    .leftJoin(milkmanProfiles, eq(milkmanProfiles.milkmanId, saasSubscriptions.milkmanId))
    .leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId))
    .where(eq(saasSubscriptions.status, 'PENDING_VERIFICATION'))
    .orderBy(saasSubscriptions.createdAt);
}

/** Every subscription past its end date but still marked live. Used by the expiry job. */
export async function findLapsedSubscriptions(now = new Date()) {
  return db
    .select({ id: saasSubscriptions.id, milkmanId: saasSubscriptions.milkmanId })
    .from(saasSubscriptions)
    .where(
      and(
        inArray(saasSubscriptions.status, ['TRIAL', 'ACTIVE']),
        lt(saasSubscriptions.endsAt, now),
      ),
    );
}

export async function markExpired(ids) {
  if (ids.length === 0) return 0;
  const result = await db
    .update(saasSubscriptions)
    .set({ status: 'EXPIRED', updatedAt: new Date() })
    .where(inArray(saasSubscriptions.id, ids))
    .returning({ id: saasSubscriptions.id });
  return result.length;
}

/** Platform payment ledger, newest first. */
export async function listSaasPayments({ limit = 50, offset = 0 } = {}) {
  return db
    .select({
      id: saasPayments.id,
      milkmanId: saasPayments.milkmanId,
      milkmanName: users.name,
      businessName: milkmanProfiles.businessName,
      amount: saasPayments.amount,
      reference: saasPayments.reference,
      status: saasPayments.status,
      verifiedAt: saasPayments.verifiedAt,
      createdAt: saasPayments.createdAt,
    })
    .from(saasPayments)
    .innerJoin(users, eq(users.id, saasPayments.milkmanId))
    .leftJoin(milkmanProfiles, eq(milkmanProfiles.milkmanId, saasPayments.milkmanId))
    .orderBy(desc(saasPayments.createdAt))
    .limit(limit)
    .offset(offset);
}

/** The single settings row, created on first read if absent. */
export async function getPlatformSettings() {
  const [row] = await db.select().from(platformSettings).limit(1);
  if (row) return row;

  const [created] = await db.insert(platformSettings).values({ id: 1 }).returning();
  return created;
}
