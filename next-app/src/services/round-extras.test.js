/**
 * Extras on the milkman's round.
 *
 * Purchases had their own screen and nothing put them in front of the person
 * actually doing the round, so a customer could order paneer and the milkman
 * would cycle past without it. Worse, a customer with no milk plan running
 * that day produced no stop at all — the round never took the milkman to their
 * door, and the order simply sat there.
 *
 * Fixtures are created and removed again; assertions are relative to whatever
 * is already on the round, because these run against a live database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('round extras', () => {
  let db, sql, delivery, actor, milkmanId, today, baseline;
  const made = [];

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    const { businessDate } = await import('@/domain/dates.js');
    delivery = await import('@/services/delivery.service.js');
    today = businessDate();

    const result = await db.execute(
      sql`select id, name, email from "app".users where role = 'MILKMAN' limit 1`,
    );
    const milkman = (result.rows ?? result)[0];
    if (!milkman) return;
    milkmanId = milkman.id;

    actor = {
      userId: milkman.id, clerkId: 'test', email: milkman.email, name: milkman.name,
      role: ROLES.MILKMAN, tenantId: milkman.id, approvalStatus: null,
      isVerified: true, isActive: true,
      can: (p) => roleHas(ROLES.MILKMAN, p),
      scope: (p) => scopeFor(ROLES.MILKMAN, p),
    };

    // One customer receiving milk today and one not, so both paths are covered.
    const rows = await db.execute(sql`
      select u.id, u.name,
             exists(select 1 from "app".deliveries d
                     where d.customer_id = u.id and d.delivery_date = ${today}) as has_milk
        from "app".users u
       where u.role = 'CUSTOMER' and u.milkman_id = ${milkmanId}`);
    const customers = rows.rows ?? rows;
    const picked = [
      customers.find((c) => c.has_milk),
      customers.find((c) => !c.has_milk),
    ].filter(Boolean);

    baseline = await delivery.getRound(actor, today);

    for (const customer of picked) {
      const created = await db.execute(sql`
        insert into "app".purchases
          (customer_id, milkman_id, product_name, unit, quantity, unit_price, order_date, status)
        values (${customer.id}, ${milkmanId}, 'Test Paneer', 'kg', '1.000',
                '400.0000', ${today}, 'PENDING')
        returning id`);
      made.push({
        id: (created.rows ?? created)[0].id,
        customerId: customer.id,
        hadMilk: Boolean(customer.has_milk),
      });
    }
  });

  afterAll(async () => {
    if (!db) return;
    for (const row of made) {
      await db.execute(sql`delete from "app".purchases where id = ${row.id}`);
    }
  });

  it('attaches each extra to the stop it belongs to', async () => {
    if (made.length === 0) return;
    const { stops } = await delivery.getRound(actor, today);

    for (const row of made) {
      const stop = stops.find((s) => s.customerId === row.customerId);
      expect(stop).toBeTruthy();
      expect(stop.extras.map((e) => e.productName)).toContain('Test Paneer');
    }
  });

  it('gives a customer with extras but no milk their own carry-only stop', async () => {
    const extrasOnly = made.find((row) => !row.hadMilk);
    if (!extrasOnly) return;

    const { stops } = await delivery.getRound(actor, today);
    const stop = stops.find((s) => s.customerId === extrasOnly.customerId);

    expect(stop).toBeTruthy();
    expect(stop.milkless).toBe(true);
    // Nothing to mark delivered — there is no delivery row behind it.
    expect(stop.plannedQuantity).toBeUndefined();
  });

  it('counts extras in the day total alongside milk', async () => {
    if (made.length === 0) return;
    const { summary } = await delivery.getRound(actor, today);

    expect(summary.extrasCount).toBe(baseline.summary.extrasCount + made.length);
    expect(summary.extrasPaise).toBe(baseline.summary.extrasPaise + made.length * 40000);
    expect(summary.billedPaise).toBe(summary.milkPaise + summary.extrasPaise);
  });

  it('leaves cancelled orders off the round', async () => {
    const row = made[0];
    if (!row) return;

    await db.execute(sql`
      update "app".purchases set status = 'CANCELLED' where id = ${row.id}`);
    try {
      const { stops } = await delivery.getRound(actor, today);
      const stop = stops.find((s) => s.customerId === row.customerId);
      const ids = (stop?.extras ?? []).map((e) => e.id);
      expect(ids).not.toContain(row.id);
    } finally {
      await db.execute(sql`
        update "app".purchases set status = 'PENDING' where id = ${row.id}`);
    }
  });
});
