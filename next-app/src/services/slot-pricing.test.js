/**
 * "Morning & evening" means two deliveries.
 *
 * The slot was stored, displayed, and then ignored by everything that mattered:
 * the generator emitted one row a day carrying the slot `BOTH`, the quote
 * counted one drop, and the bill followed the rows. A customer receiving milk
 * twice a day was quoted and charged for once.
 *
 * Fixtures are created and removed again.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const DATE = '2026-05-14';
const MONTH = '2026-05';

suite('morning and evening', () => {
  let db, sql, delivery, subscriptions, pricing, milkman, customer, planId, custId, fixture;
  const rootIds = [];

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    delivery = await import('@/services/delivery.service.js');
    subscriptions = await import('@/services/subscription.service.js');
    pricing = await import('@/domain/pricing.js');

    const rows = await db.execute(sql`
      select id, name, email from "app".users where role = 'MILKMAN' limit 1`);
    const mm = (rows.rows ?? rows)[0];
    if (!mm) return;

    milkman = {
      userId: mm.id, clerkId: 'test', email: mm.email, name: mm.name,
      role: ROLES.MILKMAN, tenantId: mm.id, approvalStatus: null,
      isVerified: true, isActive: true,
      can: (p) => roleHas(ROLES.MILKMAN, p), scope: (p) => scopeFor(ROLES.MILKMAN, p),
    };

    // Their own customer: one delivery per time of day means a borrowed one
    // would usually already hold the slot this suite wants.
    fixture = await createTestCustomer(db, sql, mm.id, 'slots');
    custId = fixture.id;
    customer = customerActor(fixture, mm.id, { ROLES, roleHas, scopeFor });

    // ₹30 a litre on 2 L, morning and evening.
    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, evening_start, evening_end, price_per_delivery)
      values (${mm.id}, 'Slot Test Plan', 'cow milk', '2.000', 'L', 'DAILY', 'BOTH',
              '06:00', '07:30', '17:30', '19:00', '60.00')
      returning id`);
    planId = (created.rows ?? created)[0].id;
  });

  afterAll(async () => {
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    if (!planId) return;
    for (const rootId of rootIds) {
      await db.execute(sql`delete from "app".deliveries where subscription_root_id = ${rootId}`);
      await db.execute(sql`delete from "app".milk_subscriptions where root_id = ${rootId}`);
    }
    await db.execute(sql`delete from "app".notifications where subject_id in (
      select id from "app".milk_subscriptions where plan_id = ${planId})`);
    await db.execute(sql`delete from "app".milk_plans where id = ${planId}`);
  });

  it('quotes a both-slot plan at two drops a day', () => {
    const plan = { pricePerDelivery: '60', quantity: '2', frequency: 'DAILY', slot: 'BOTH' };
    // May has 31 days, so 62 drops at ₹60.
    expect(pricing.countDeliveries(plan, MONTH)).toBe(62);
    expect(pricing.quotedMonthlyPaise(plan, MONTH)).toBe(62 * 6000);

    const morningOnly = { ...plan, slot: 'MORNING' };
    expect(pricing.quotedMonthlyPaise(morningOnly, MONTH)).toBe(31 * 6000);
  });

  it('splits a monthly price across both drops rather than doubling it', () => {
    const plan = { monthlyPrice: '1800', quantity: '2', frequency: 'DAILY', slot: 'BOTH' };
    // The milkman said ₹1800 a month; that is what a full month costs.
    expect(pricing.quotedMonthlyPaise(plan, '2026-09')).toBe(180000);
    // And each drop is half of a single-slot plan's.
    expect(pricing.resolveUnitPrice(plan, '2026-09').perDeliveryPaise).toBe(3000);
  });

  it('generates a morning row and an evening row for one day', async () => {
    if (!planId) return;
    const created = await subscriptions.subscribe(customer, { planId });
    rootIds.push(created.rootId);

    await db.execute(sql`
      update "app".milk_subscriptions set effective_from = ${DATE} where root_id = ${created.rootId}`);
    await delivery.generateForDate(DATE);

    const rows = await db.execute(sql`
      select slot, planned_quantity, unit_price from "app".deliveries
       where subscription_root_id = ${created.rootId} and delivery_date = ${DATE}
       order by slot`);
    const drops = rows.rows ?? rows;

    expect(drops).toHaveLength(2);
    expect(drops.map((d) => d.slot).sort()).toEqual(['EVENING', 'MORNING']);
    // Each drop carries the full plan quantity — 2 L morning and 2 L evening.
    for (const drop of drops) expect(Number(drop.planned_quantity)).toBe(2);
    // And no row is left carrying the abstract 'BOTH'.
    expect(drops.some((d) => d.slot === 'BOTH')).toBe(false);
  });

  it('stays idempotent: a second run adds nothing', async () => {
    if (!planId || rootIds.length === 0) return;
    const before = await delivery.generateForDate(DATE);
    expect(before.created).toBe(0);

    const rows = await db.execute(sql`
      select count(*)::int as n from "app".deliveries
       where subscription_root_id = ${rootIds[0]} and delivery_date = ${DATE}`);
    expect((rows.rows ?? rows)[0].n).toBe(2);
  });

  it('leaves a day already covered by a pre-split BOTH row alone', async () => {
    if (!planId || rootIds.length === 0) return;

    // A row as the old generator wrote them: one per day, slot BOTH.
    const legacyDate = '2026-05-20';
    const sub = await db.execute(sql`
      select id from "app".milk_subscriptions where root_id = ${rootIds[0]}`);
    const versionId = (sub.rows ?? sub)[0].id;

    await db.execute(sql`
      insert into "app".deliveries
        (subscription_root_id, subscription_version_id, customer_id, milkman_id,
         delivery_date, slot, product_name, unit, planned_quantity, unit_price, status)
      values (${rootIds[0]}, ${versionId}, ${customer.userId}, ${milkman.userId},
              ${legacyDate}, 'BOTH', 'cow milk', 'L', '2.000', '30.0000', 'PENDING')`);

    await delivery.generateForDate(legacyDate);

    const rows = await db.execute(sql`
      select count(*)::int as n from "app".deliveries
       where subscription_root_id = ${rootIds[0]} and delivery_date = ${legacyDate}`);

    // Still one row. Adding a morning and an evening beside it would bill the
    // day twice, and the BOTH row may already be delivered and invoiced.
    expect((rows.rows ?? rows)[0].n).toBe(1);
  });

  it('drops a cancelled delivery from both the round and the customer day', async () => {
    if (!planId || rootIds.length === 0) return;

    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    const customerActor = {
      userId: custId, clerkId: 'test', email: 't@t', name: 'Test',
      role: ROLES.CUSTOMER, tenantId: milkman.userId, approvalStatus: 'APPROVED',
      isVerified: true, isActive: true,
      can: (p) => roleHas(ROLES.CUSTOMER, p), scope: (p) => scopeFor(ROLES.CUSTOMER, p),
    };

    const before = await delivery.getCustomerDay(customerActor, DATE);
    const target = before.deliveries.find((d) => d.status === 'PENDING');
    if (!target) return;

    await db.execute(sql`
      update "app".deliveries set status = 'CANCELLED' where id = ${target.id}`);

    /*
     * A withdrawn delivery is not part of the day. It used to keep its card on
     * the customer's dashboard, complete with "Change quantity" and "Skip
     * today" for a plan they had already cancelled.
     */
    const after = await delivery.getCustomerDay(customerActor, DATE);
    expect(after.deliveries.map((d) => d.id)).not.toContain(target.id);

    const { stops, summary } = await delivery.getRound(milkman, DATE);
    expect(stops.map((s) => s.id)).not.toContain(target.id);
    // The header must agree with the list below it.
    expect(summary.total).toBe(stops.length);
  });

  it('bills both drops', async () => {
    if (!planId || rootIds.length === 0) return;
    await db.execute(sql`
      update "app".deliveries
         set status = 'DELIVERED', delivered_quantity = planned_quantity, delivered_at = now()
       where subscription_root_id = ${rootIds[0]} and delivery_date = ${DATE}`);

    const rows = await db.execute(sql`
      select coalesce(sum(amount), 0)::text as total from "app".deliveries
       where subscription_root_id = ${rootIds[0]} and delivery_date = ${DATE}`);

    // 2 L x ₹30 x two drops.
    expect(Number((rows.rows ?? rows)[0].total)).toBe(120);
  });
});
