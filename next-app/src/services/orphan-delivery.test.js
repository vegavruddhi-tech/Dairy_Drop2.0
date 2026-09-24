/**
 * A delivery must not outlive its subscription.
 *
 * The customer's day and the milkman's round join the subscription for its
 * delivery window — as a LEFT join, so a plan with no window set still shows.
 * That leniency meant a delivery whose subscription had been removed outright
 * kept rendering: the customer saw pending milk for a plan that no longer
 * existed anywhere.
 *
 * A superseded version still exists, so a day running on old terms is not an
 * orphan. Only a subscription that is genuinely gone should hide its days.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('a delivery whose subscription was removed', () => {
  let db, sql, roles, delivery, subs, fixture, customer, milkman, today, rootId, planId;

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    delivery = await import('@/services/delivery.service.js');
    subs = await import('@/services/subscription.service.js');
    ({ businessDate: today } = await import('@/domain/dates.js'));
    today = today();

    const rows = await db.execute(sql`
      select id, name, email from "app".users where role = 'MILKMAN' limit 1`);
    const mm = (rows.rows ?? rows)[0];
    if (!mm) return;

    milkman = {
      userId: mm.id, clerkId: 'test', email: mm.email, name: mm.name,
      role: roles.ROLES.MILKMAN, tenantId: mm.id, approvalStatus: null,
      isVerified: true, isActive: true,
      can: (p) => roles.roleHas(roles.ROLES.MILKMAN, p),
      scope: (p) => roles.scopeFor(roles.ROLES.MILKMAN, p),
    };
    fixture = await createTestCustomer(db, sql, mm.id, 'orphan');
    customer = customerActor(fixture, mm.id, roles);

    const plan = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, price_per_delivery)
      values (${mm.id}, 'Orphan Test', 'orphan milk', '1.000', 'L', 'DAILY', 'MORNING',
              '06:00', '07:30', '50.00')
      returning id`);
    planId = (plan.rows ?? plan)[0].id;

    const created = await subs.subscribe(customer, { planId });
    rootId = created.rootId;
    await db.execute(sql`
      update "app".milk_subscriptions set effective_from = ${today} where root_id = ${rootId}`);
    await delivery.generateForDate(today);
  });

  afterAll(async () => {
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    if (planId) await db.execute(sql`delete from "app".milk_plans where id = ${planId}`);
  });

  it('shows while the subscription exists', async () => {
    if (!rootId) return;
    const { deliveries } = await delivery.getCustomerDay(customer, today);
    expect(deliveries.some((d) => d.subscriptionRootId === rootId)).toBe(true);
  });

  it('disappears from the customer day and the round once it is gone', async () => {
    if (!rootId) return;
    // What actually happened: the subscription rows were removed outright,
    // not cancelled, so nothing withdrew their pending days.
    await db.execute(sql`delete from "app".milk_subscriptions where root_id = ${rootId}`);

    const { deliveries } = await delivery.getCustomerDay(customer, today);
    expect(deliveries.some((d) => d.subscriptionRootId === rootId)).toBe(false);

    const { stops, summary } = await delivery.getRound(milkman, today);
    const mine = stops.filter((s) => s.customerId === fixture.id);
    expect(mine.flatMap((s) => s.items ?? []).some((i) => i.subscriptionRootId === rootId)).toBe(false);
    // The header is a separate aggregate with no subscription join; it must
    // exclude the orphan by the same rule or it counts a stop the list hides.
    expect(summary.total).toBe(stops.length);
  });
});
