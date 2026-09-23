/**
 * Delivery windows.
 *
 * A milkman sets, per plan, the hours the round actually reaches the door. The
 * window is a range rather than an instant because one bike covers a whole
 * area — "06:00" would be a promise broken at every door but the first.
 *
 * It is snapshotted onto the subscription with the rest of the agreed terms,
 * so editing the plan later cannot silently move the time an existing customer
 * was told. These tests pin that, and the rule that a plan only carries windows
 * for the slots it actually runs.
 *
 * Fixtures are created and removed again.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('delivery windows', () => {
  let db, sql, subscriptions, milkman, customer, planId, secondPlanId, rootIds = [];

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    subscriptions = await import('@/services/subscription.service.js');

    const rows = await db.execute(sql`
      select u.id, u.name, u.email, u.milkman_id, u.role from "app".users
        u where u.role in ('MILKMAN','CUSTOMER') order by u.role`);
    const all = rows.rows ?? rows;
    const mm = all.find((r) => r.role === 'MILKMAN');
    const cu = all.find((r) => r.role === 'CUSTOMER' && r.milkman_id === mm?.id);
    if (!mm || !cu) return;

    const actorFor = (role, id, tenantId) => ({
      userId: id, clerkId: 'test', email: 't@t', name: 'Test', role, tenantId,
      approvalStatus: role === ROLES.CUSTOMER ? 'APPROVED' : null,
      isVerified: true, isActive: true,
      can: (p) => roleHas(role, p), scope: (p) => scopeFor(role, p),
    });
    milkman = actorFor(ROLES.MILKMAN, mm.id, mm.id);
    customer = actorFor(ROLES.CUSTOMER, cu.id, mm.id);

    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, evening_start, evening_end, monthly_price)
      values (${mm.id}, 'Window Test Plan', 'cow milk', '1.000', 'L', 'DAILY', 'BOTH',
              '06:00', '07:30', '17:30', '19:00', '1500.00')
      returning id`);
    planId = (created.rows ?? created)[0].id;

    const second = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, evening_start, evening_end, monthly_price)
      values (${mm.id}, 'Window Test Plan 2', 'cow milk', '1.000', 'L', 'DAILY', 'BOTH',
              '06:00', '07:30', '17:30', '19:00', '1500.00')
      returning id`);
    secondPlanId = (second.rows ?? second)[0].id;
  });

  afterAll(async () => {
    if (!db || !planId) return;
    for (const rootId of rootIds) {
      await db.execute(sql`delete from "app".deliveries where subscription_root_id = ${rootId}`);
      await db.execute(sql`delete from "app".milk_subscriptions where root_id = ${rootId}`);
    }
    await db.execute(sql`delete from "app".notifications where subject_id in (
      select id from "app".milk_subscriptions where plan_id in (${planId}, ${secondPlanId}))`);
    await db.execute(sql`delete from "app".milk_plans where id in (${planId}, ${secondPlanId})`);
  });

  it('refuses a window that ends before it starts', async () => {
    if (!planId) return;
    await expect(
      db.execute(sql`
        insert into "app".milk_plans
          (milkman_id, name, product_name, quantity, monthly_price, slot,
           morning_start, morning_end)
        values (${milkman.userId}, 'Bad', 'x', '1.000', '100.00', 'MORNING',
                '07:30', '06:00')`),
    ).rejects.toThrow();
  });

  it('refuses half a window', async () => {
    if (!planId) return;
    await expect(
      db.execute(sql`
        insert into "app".milk_plans
          (milkman_id, name, product_name, quantity, monthly_price, slot, morning_start)
        values (${milkman.userId}, 'Half', 'x', '1.000', '100.00', 'MORNING', '06:00')`),
    ).rejects.toThrow();
  });

  it('snapshots the window onto the subscription at enrolment', async () => {
    if (!planId) return;
    const created = await subscriptions.subscribe(customer, { planId });
    rootIds.push(created.rootId);

    expect(created.morningStart).toBe('06:00:00');
    expect(created.morningEnd).toBe('07:30:00');
    expect(created.eveningStart).toBe('17:30:00');
    expect(created.eveningEnd).toBe('19:00:00');
  });

  it('keeps the promised window when the plan is edited afterwards', async () => {
    if (!planId || rootIds.length === 0) return;

    await db.execute(sql`
      update "app".milk_plans
         set morning_start = '08:00', morning_end = '09:00'
       where id = ${planId}`);

    const row = await db.execute(sql`
      select morning_start from "app".milk_subscriptions
       where root_id = ${rootIds[0]} and effective_to is null`);

    // The customer still has the hours they agreed to, not the new ones.
    expect((row.rows ?? row)[0].morning_start).toBe('06:00:00');
  });

  it('carries only the window for the slot the customer actually takes', async () => {
    if (!secondPlanId) return;
    const created = await subscriptions.subscribe(customer, { planId: secondPlanId, slot: 'MORNING' });
    rootIds.push(created.rootId);

    expect(created.morningStart).toBeTruthy();
    // No evening hours for someone who never gets an evening delivery.
    expect(created.eveningStart).toBeNull();
    expect(created.eveningEnd).toBeNull();
  });
});
