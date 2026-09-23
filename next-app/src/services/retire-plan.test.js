/**
 * Retiring a plan ends the subscriptions on it.
 *
 * It used to be a catalog action only — the plan stopped being offered and
 * existing customers carried on. Gentler, and deliberate, but it stranded
 * customers on a plan nobody could move them to and gave a milkman no way to
 * wind one down.
 *
 * The line that must not move: days already delivered stay delivered and stay
 * billed. Retiring stops future milk; it does not rewrite money that has
 * already changed hands.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('retiring a plan', () => {
  let db, sql, roles, subs, repo, delivery, today;
  let milkman, customer, fixture, planId;
  const planIds = [];

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    subs = await import('@/services/subscription.service.js');
    repo = await import('@/repositories/subscriptions.repo.js');
    delivery = await import('@/services/delivery.service.js');
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

    fixture = await createTestCustomer(db, sql, mm.id, 'retire');
    customer = customerActor(fixture, mm.id, roles);

    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, evening_start, evening_end, price_per_delivery)
      values (${mm.id}, 'Retire Test', 'retire milk', '1.000', 'L', 'DAILY', 'BOTH',
              '06:00', '07:30', '17:30', '19:00', '50.00')
      returning id`);
    planId = (created.rows ?? created)[0].id;
    planIds.push(planId);

    await subs.subscribe(customer, { planId });
    await db.execute(sql`
      update "app".milk_subscriptions set effective_from = ${today}
       where customer_id = ${fixture.id}`);
    await delivery.generateForDate(today);

    // One of the two drops has already happened.
    await db.execute(sql`
      update "app".deliveries
         set status = 'DELIVERED', delivered_quantity = planned_quantity, delivered_at = now()
       where customer_id = ${fixture.id} and delivery_date = ${today} and slot = 'MORNING'`);
  });

  afterAll(async () => {
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    for (const id of planIds) {
      await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
    }
  });

  it('counts who would be cut off, so the milkman sees it before clicking', async () => {
    if (!planId) return;
    expect(await repo.countSubscribersOfPlan(milkman, planId)).toBe(1);
  });

  it('ends the subscription and takes the plan out of the catalog', async () => {
    if (!planId) return;
    const result = await subs.retirePlan(milkman, { planId });

    expect(result.ended).toBe(1);
    expect(result.plan.isActive).toBe(false);
    expect(await repo.countSubscribersOfPlan(milkman, planId)).toBe(0);

    // Gone from "My plans".
    const mine = await subs.listMine(customer);
    expect(mine.filter((s) => s.status !== 'CANCELLED')).toHaveLength(0);
  });

  it('withdraws the undelivered day but leaves the delivered one billed', async () => {
    if (!planId) return;
    const rows = await db.execute(sql`
      select slot, status, amount::text as amount from "app".deliveries
       where customer_id = ${fixture.id} and delivery_date = ${today}
       order by slot`);
    const byslot = Object.fromEntries((rows.rows ?? rows).map((r) => [r.slot, r]));

    // The evening never happened, so it is called off.
    expect(byslot.EVENING.status).toBe('CANCELLED');
    // The morning did, and the money stands.
    expect(byslot.MORNING.status).toBe('DELIVERED');
    expect(Number(byslot.MORNING.amount)).toBeGreaterThan(0);
  });

  it('clears the customer dashboard of the withdrawn day', async () => {
    if (!planId) return;
    const { deliveries } = await delivery.getCustomerDay(customer, today);
    // The delivered morning still shows; the cancelled evening does not.
    expect(deliveries.map((d) => d.slot)).not.toContain('EVENING');
  });

  it('tells the customer their plan has ended', async () => {
    if (!planId) return;
    const rows = await db.execute(sql`
      select title from "app".notifications
       where user_id = ${fixture.id} and type = 'SUBSCRIPTION'
       order by created_at desc limit 1`);
    expect((rows.rows ?? rows)[0]?.title).toMatch(/plan has ended/i);
  });
});
