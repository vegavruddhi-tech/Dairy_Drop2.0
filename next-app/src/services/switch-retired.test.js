/**
 * Stepping off a plan the milkman has withdrawn.
 *
 * A customer on a retired plan was stuck: the subscription still held its
 * delivery time, so every plan on offer read "already on this", and the only
 * exits were cancelling their milk altogether or waiting on a change request
 * the milkman had to approve. They did not choose to be there — the plan was
 * taken out of the catalog underneath them.
 *
 * The escape is deliberately narrow: it refuses unless the plan being left has
 * genuinely been retired, so an ordinary change still goes through the milkman.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('switching off a retired plan', () => {
  let db, sql, roles, subs, repo, fixture, customer, milkmanId;
  let retiredPlanId, livePlanId, rootId;
  const planIds = [];

  async function makePlan(name, isActive) {
    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, price_per_delivery, is_active)
      values (${milkmanId}, ${name}, 'switch milk', '1.000', 'L', 'DAILY', 'MORNING',
              '06:00', '07:30', '50.00', ${isActive})
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

    const rows = await db.execute(sql`
      select id from "app".users where role = 'MILKMAN' limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;

    fixture = await createTestCustomer(db, sql, milkmanId, 'switch');
    customer = customerActor(fixture, milkmanId, roles);

    // Subscribe while it is still offered, then the milkman withdraws it.
    retiredPlanId = await makePlan('Switch From', true);
    const created = await subs.subscribe(customer, { planId: retiredPlanId });
    rootId = created.rootId;
    await db.execute(sql`
      update "app".milk_plans set is_active = false where id = ${retiredPlanId}`);

    livePlanId = await makePlan('Switch To', true);
  });

  afterAll(async () => {
    if (!db) return;
    await removeTestCustomer(db, sql, fixture?.id);
    for (const id of planIds) {
      await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
    }
  });

  it('moves the customer onto a plan still on offer', async () => {
    if (!milkmanId) return;
    const next = await subs.switchFromRetiredPlan(customer, { rootId, planId: livePlanId });

    expect(next.planId).toBe(livePlanId);
    // Versioned, so today is still billed on the old terms.
    expect(next.effectiveFrom > new Date().toISOString().slice(0, 10)).toBe(true);

    const current = await repo.findCurrentByRoot(customer, rootId);
    expect(current.planId).toBe(livePlanId);
  });

  it('leaves the customer with one subscription, not two', async () => {
    if (!milkmanId) return;
    const mine = await subs.listMine(customer);
    expect(mine.filter((s) => s.status === 'ACTIVE')).toHaveLength(1);
  });

  it('refuses when the plan being left is still offered', async () => {
    if (!milkmanId) return;
    // They are now on a live plan, so this is an ordinary change.
    const another = await makePlan('Switch Elsewhere', true);
    await expect(
      subs.switchFromRetiredPlan(customer, { rootId, planId: another }),
    ).rejects.toThrow(/still offered/i);
  });

  it('refuses to switch onto a plan that is itself retired', async () => {
    if (!milkmanId) return;
    await db.execute(sql`
      update "app".milk_plans set is_active = false where id = ${livePlanId}`);
    const alsoRetired = await makePlan('Switch Dead', false);

    await expect(
      subs.switchFromRetiredPlan(customer, { rootId, planId: alsoRetired }),
    ).rejects.toThrow(/That plan/i);
  });
});
