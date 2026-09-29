/**
 * A milkman changing a customer's plan directly.
 *
 * Until now only the customer could start a change, and the milkman could only
 * approve or decline it. This goes the other way through the same versioned
 * `applyPlanChange`, so the checks that matter are the ones specific to it:
 * the customer sees the new plan and is told, their own pending request is
 * closed, and a milkman cannot reach another milkman's customer.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('milkman changes a customer plan', () => {
  let db, sql, roles, subs, repo, fixture, customer, milkman, milkmanId;
  let fromPlanId, toPlanId, rootId;
  const planIds = [];

  async function makePlan(name, product) {
    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, price_per_delivery, is_active)
      values (${milkmanId}, ${name}, ${product}, '1.000', 'L', 'DAILY', 'MORNING',
              '06:00', '07:30', '50.00', true)
      returning id`);
    const id = (created.rows ?? created)[0].id;
    planIds.push(id);
    return id;
  }

  const actorFor = (userId, role, tenantId) => ({
    userId, clerkId: 'test', email: 'test@dairydrop.test', name: 'Test',
    role, tenantId, approvalStatus: null, isVerified: true, isActive: true,
    can: (p) => roles.roleHas(role, p),
    scope: (p) => roles.scopeFor(role, p),
  });

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    subs = await import('@/services/subscription.service.js');
    repo = await import('@/repositories/subscriptions.repo.js');

    const rows = await db.execute(sql`select id from "app".users where role = 'MILKMAN' limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;

    milkman = actorFor(milkmanId, roles.ROLES.MILKMAN, milkmanId);
    fixture = await createTestCustomer(db, sql, milkmanId, 'mmchange');
    customer = customerActor(fixture, milkmanId, roles);

    fromPlanId = await makePlan('MM Change From', 'mmchange milk');
    toPlanId = await makePlan('MM Change To', 'mmchange milk');
    rootId = (await subs.subscribe(customer, { planId: fromPlanId })).rootId;

    // The customer has asked for a change of their own, still pending.
    await db.execute(sql`
      insert into "app".plan_change_requests
        (subscription_root_id, customer_id, milkman_id, requested_plan_id,
         current_plan_name, current_quantity, current_unit,
         requested_plan_name, requested_quantity, requested_unit, customer_note, status)
      values (${rootId}, ${fixture.id}, ${milkmanId}, ${toPlanId},
              'MM Change From', '1.000', 'L', 'MM Change To', '1.000', 'L', 'please switch', 'PENDING')`);
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`delete from "app".plan_change_requests where customer_id = ${fixture?.id ?? null}`);
    await removeTestCustomer(db, sql, fixture?.id);
    for (const id of planIds) await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
  });

  it('refuses a milkman who does not serve the customer', async () => {
    if (!milkmanId) return;
    const stranger = actorFor('00000000-0000-0000-0000-000000000001', roles.ROLES.MILKMAN,
      '00000000-0000-0000-0000-000000000001');
    await expect(subs.changeCustomerPlan(stranger, { rootId, planId: toPlanId }))
      .rejects.toThrow(/subscription/i);
  });

  it('refuses a change to the plan and amount they already have', async () => {
    if (!milkmanId) return;
    await expect(subs.changeCustomerPlan(milkman, { rootId, planId: fromPlanId }))
      .rejects.toThrow(/already on/i);
  });

  it('moves the customer, at a custom quantity, and they see it', async () => {
    if (!milkmanId) return;
    const result = await subs.changeCustomerPlan(milkman, { rootId, planId: toPlanId, quantity: '1.5' });
    expect(result.planName).toBe('MM Change To');

    // The customer's own view resolves to the new plan and amount.
    const mine = await repo.findCurrentByRoot(customer, rootId);
    expect(mine.planId).toBe(toPlanId);
    expect(Number(mine.quantity)).toBe(1.5);

    const notes = await db.execute(sql`
      select title from "app".notifications
       where user_id = ${fixture.id} and type = 'PLAN_CHANGE'`);
    expect((notes.rows ?? notes).map((n) => n.title)).toContain('Your milkman changed your plan');
  });

  it('closes the request the customer had open on that subscription', async () => {
    if (!milkmanId) return;
    const rows = await db.execute(sql`
      select status from "app".plan_change_requests where subscription_root_id = ${rootId}`);
    expect((rows.rows ?? rows).map((r) => r.status)).toEqual(['REJECTED']);
  });
});
