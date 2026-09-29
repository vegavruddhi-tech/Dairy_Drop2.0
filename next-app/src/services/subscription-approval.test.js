/**
 * A plan is a rate card; the customer picks the quantity; the milkman approves.
 *
 * Covers the three pieces that are new together: the quote follows the chosen
 * litres, a new subscription waits as PENDING (holding its slot, generating
 * nothing), and the milkman's answer either opens it or frees the slot.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('subscription requests', () => {
  let db, sql, roles, subs, repo, fixture, customer, milkman, milkmanId;
  const planIds = [];

  async function makeRatePlan(name, product, perLitre) {
    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, price_per_delivery, is_active)
      values (${milkmanId}, ${name}, ${product}, '1.000', 'L', 'DAILY', 'MORNING',
              '06:00', '07:30', ${perLitre}, true)
      returning id`);
    const id = (created.rows ?? created)[0].id;
    planIds.push(id);
    return id;
  }

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    subs = await import('@/services/subscription.service.js');
    repo = await import('@/repositories/subscriptions.repo.js');

    const rows = await db.execute(sql`select id from "app".users where role = 'MILKMAN' limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;

    milkman = {
      userId: milkmanId, clerkId: 'test', email: 't@dairydrop.test', name: 'Test',
      role: roles.ROLES.MILKMAN, tenantId: milkmanId, approvalStatus: null, isVerified: true, isActive: true,
      can: (p) => roles.roleHas(roles.ROLES.MILKMAN, p),
      scope: (p) => roles.scopeFor(roles.ROLES.MILKMAN, p),
    };
    fixture = await createTestCustomer(db, sql, milkmanId, 'subapproval');
    customer = customerActor(fixture, milkmanId, roles);
  });

  afterAll(async () => {
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    for (const id of planIds) await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
  });

  it('prices the quantity the customer chose and waits as PENDING', async () => {
    if (!milkmanId) return;
    const planId = await makeRatePlan('Approval Cow', 'approval cow milk', '60.00');
    const created = await subs.subscribe(customer, { planId, quantity: '2.5' });

    expect(created.status).toBe('PENDING');
    expect(Number(created.quantity)).toBe(2.5);
    expect(Number(created.unitPrice)).toBe(60);
    // 2.5 L × ₹60 = ₹150 a drop; the month is that times its deliveries.
    const month = created.effectiveFrom.slice(0, 7);
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    expect(Number(created.quotedMonthlyPrice)).toBe(150 * days);

    // It holds its slot: the same product in the same shift is refused.
    const again = await makeRatePlan('Approval Cow 2', 'approval cow milk', '62.00');
    await expect(subs.subscribe(customer, { planId: again, quantity: '1' })).rejects.toThrow(/already/i);

    // It is in the milkman's inbox.
    const inbox = await repo.listPendingRequests(milkman);
    expect(inbox.some((r) => r.rootId === created.rootId)).toBe(true);
  });

  it('approving makes it ACTIVE from the next round the cut-off allows', async () => {
    if (!milkmanId) return;
    const [pending] = (await repo.listPendingRequests(milkman)).filter((r) => r.customerId === fixture.id);
    const result = await subs.decideSubscription(milkman, { rootId: pending.rootId, approve: true });

    expect(result.approved).toBe(true);
    const now = await repo.findCurrentByRoot(customer, pending.rootId);
    expect(now.status).toBe('ACTIVE');
    expect(now.effectiveFrom).toBe(result.startsOn);
    await expect(subs.decideSubscription(milkman, { rootId: pending.rootId, approve: true }))
      .rejects.toThrow(/already been answered/i);
  });

  it('declining closes the request and frees the slot', async () => {
    if (!milkmanId) return;
    const planId = await makeRatePlan('Approval Buffalo', 'approval buffalo milk', '80.00');
    const created = await subs.subscribe(customer, { planId, quantity: '1' });
    await subs.decideSubscription(milkman, { rootId: created.rootId, approve: false, note: 'Not in your sector yet' });

    const rows = await db.execute(sql`
      select status, effective_to is not null as closed from "app".milk_subscriptions where id = ${created.id}`);
    expect((rows.rows ?? rows)[0]).toMatchObject({ status: 'CANCELLED', closed: true });

    // The slot is free again.
    const retry = await subs.subscribe(customer, { planId, quantity: '1.5' });
    expect(retry.status).toBe('PENDING');
  });
});

suite('milkman adjusts a request before approving', () => {
  let db, sql, roles, subs, repo, fixture, customer, milkman, milkmanId;
  const planIds = [];

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    subs = await import('@/services/subscription.service.js');
    repo = await import('@/repositories/subscriptions.repo.js');
    const rows = await db.execute(sql`select id from "app".users where role = 'MILKMAN' limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;
    milkman = {
      userId: milkmanId, clerkId: 'test', email: 't@dairydrop.test', name: 'Test',
      role: roles.ROLES.MILKMAN, tenantId: milkmanId, approvalStatus: null, isVerified: true, isActive: true,
      can: (p) => roles.roleHas(roles.ROLES.MILKMAN, p),
      scope: (p) => roles.scopeFor(roles.ROLES.MILKMAN, p),
    };
    fixture = await createTestCustomer(db, sql, milkmanId, 'reqedit');
    customer = customerActor(fixture, milkmanId, roles);
    for (const [name, price] of [['ReqEdit A', '60.00'], ['ReqEdit B', '90.00']]) {
      const r = await db.execute(sql`
        insert into "app".milk_plans (milkman_id, name, product_name, quantity, unit, frequency, slot,
          morning_start, morning_end, price_per_delivery, is_active)
        values (${milkmanId}, ${name}, ${'reqedit ' + name}, '1.000', 'L', 'DAILY', 'MORNING', '06:00', '07:30', ${price}, true)
        returning id`);
      planIds.push((r.rows ?? r)[0].id);
    }
  });

  afterAll(async () => {
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    for (const id of planIds) await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
  });

  it('corrects the waiting request in place and keeps it waiting', async () => {
    if (!milkmanId) return;
    const created = await subs.subscribe(customer, { planId: planIds[0], quantity: '1' });
    await subs.changeCustomerPlan(milkman, { rootId: created.rootId, planId: planIds[1], quantity: '2' });

    const now = await repo.findCurrentByRoot(customer, created.rootId);
    expect(now.id).toBe(created.id); // same row, not a new version
    expect(now.status).toBe('PENDING');
    expect(now.planId).toBe(planIds[1]);
    expect(Number(now.quantity)).toBe(2);
    expect(Number(now.unitPrice)).toBe(90);
  });
});
