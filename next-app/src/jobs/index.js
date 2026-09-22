/**
 * Scheduled jobs.
 *
 * The previous system had exactly one automatic process — a `setInterval` inside
 * the web server that ran the subscription-expiry sync every five minutes. That
 * meant two instances ran it twice and zero instances ran it never, and the job
 * that actually mattered (generating the day's deliveries) was never wired to
 * anything at all.
 *
 * These are plain async functions with no scheduler baked in. Invoke them from
 * whatever your deployment provides: `vercel.json` crons, a systemd timer, or
 * `npm run jobs:*` from a container. `app/api/cron/[job]/route.js` exposes them
 * over HTTP behind a shared secret.
 */

import 'server-only';

import { businessDate, addDays, addMonths, businessMonth } from '@/domain/dates.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
// Interpolated into the raw SQL below so the table names render
// schema-qualified. The database also carries the previous system's tables,
// which use several of these same names for different things.
import { saasSubscriptions, deliveries } from '@/db/schema/index.js';

import * as deliveryService from '@/services/delivery.service.js';
import * as saasService from '@/services/saas.service.js';
import * as billingService from '@/services/billing.service.js';
import * as notificationsRepo from '@/repositories/notifications.repo.js';

/**
 * Create tomorrow's deliveries. Run daily, shortly after midnight IST.
 *
 * Idempotent: a unique index on (subscription_root_id, delivery_date) plus
 * `ON CONFLICT DO NOTHING` means a retry, a double-fire, or a manual backfill
 * cannot produce a second billable row.
 */
export async function generateDeliveries({ date } = {}) {
  const target = date ?? businessDate();
  const result = await deliveryService.generateForDate(target);
  return { job: 'generate-deliveries', ...result };
}

/**
 * Backfill a range after an outage.
 * `npm run jobs:deliveries -- --from 2026-09-01 --to 2026-09-05`
 */
export async function backfillDeliveries({ from, to }) {
  const results = await deliveryService.generateForRange(from, to);
  return {
    job: 'backfill-deliveries',
    days: results.length,
    created: results.reduce((total, day) => total + day.created, 0),
  };
}

/** Expire subscriptions whose period has ended. Run hourly. */
export async function expireSubscriptions() {
  const result = await saasService.expireLapsed();
  return { job: 'expire-subscriptions', ...result };
}

/**
 * Warn milkmen whose subscription is nearly up. Run daily.
 * Three days out and one day out — enough notice to act, not enough to nag.
 */
export async function remindExpiring() {
  const rows = await db.execute(sql`
    select s.milkman_id,
           s.ends_at,
           date_part('day', s.ends_at - now())::int as days_left
      from ${saasSubscriptions} s
     where s.status in ('TRIAL', 'ACTIVE')
       and s.ends_at > now()
       and date_part('day', s.ends_at - now())::int in (1, 3)
  `);

  const reminders = rows.rows ?? rows;
  if (reminders.length === 0) return { job: 'remind-expiring', sent: 0 };

  await db.transaction(async (tx) => {
    await notificationsRepo.create(
      tx,
      reminders.map((row) => ({
        userId: row.milkman_id,
        type: 'SUBSCRIPTION',
        title: `${row.days_left} day${row.days_left === 1 ? '' : 's'} left on your plan`,
        body: 'Renew to keep your panel open. Your customers and history are kept either way.',
        href: '/milkman/membership',
      })),
    );
  });

  return { job: 'remind-expiring', sent: reminders.length };
}

/**
 * Freeze last month's bills. Run on the 1st.
 *
 * A closed bill is a financial record — once stamped it is never recomputed,
 * so a delivery edited afterwards cannot silently change what someone owed.
 */
export async function closeMonth({ month } = {}) {
  const target = month ?? addMonths(businessMonth(), -1);

  const rows = await db.execute(sql`
    select distinct d.customer_id, d.milkman_id
      from ${deliveries} d
     where d.delivery_date >= ${`${target}-01`}::date
       and d.delivery_date <  (${`${target}-01`}::date + interval '1 month')
  `);

  const customers = rows.rows ?? rows;
  let closed = 0;

  for (const row of customers) {
    // A system actor: full scope, no session. Only jobs may construct one.
    const actor = systemActor(row.milkman_id);
    try {
      await billingService.closeMonth(actor, {
        customerId: row.customer_id,
        milkmanId: row.milkman_id,
        month: target,
      });
      closed += 1;
    } catch (error) {
      console.error(`[close-month] ${row.customer_id} ${target}`, error);
    }
  }

  return { job: 'close-month', month: target, closed, considered: customers.length };
}

/** Archive notifications older than 90 days. Run weekly. */
export async function archiveNotifications({ days = 90 } = {}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const archived = await notificationsRepo.archiveOlderThan(cutoff);
  return { job: 'archive-notifications', archived: archived.length };
}

/**
 * An actor for background work.
 *
 * Scoped to one tenant rather than given blanket access, so a job cannot read
 * across tenants by accident. It is not exported — only this module can mint one.
 */
function systemActor(milkmanId) {
  return {
    userId: '00000000-0000-0000-0000-000000000000',
    email: 'system@dairydrop',
    name: 'System',
    role: 'MILKMAN',
    tenantId: milkmanId,
    isActive: true,
    isVerified: true,
    approvalStatus: null,
    can: () => true,
    scope: () => 'TENANT',
  };
}

export const JOBS = {
  'generate-deliveries': generateDeliveries,
  'backfill-deliveries': backfillDeliveries,
  'expire-subscriptions': expireSubscriptions,
  'remind-expiring': remindExpiring,
  'close-month': closeMonth,
  'archive-notifications': archiveNotifications,
};
