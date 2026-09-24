/**
 * One order per product, per time of day, per customer.
 *
 * A stop is one *visit*, not one item: a milkman arriving at 6am can hand over
 * cow milk and buffalo milk together, and that is a normal order. What cannot
 * happen is the same product twice at the same time — not two orders, one
 * order written down twice.
 *
 * `BOTH` fills two times rather than being a third one, which is the case that
 * slipped through: cow milk in the morning plus cow milk morning-and-evening
 * reads as two different slots and is really a collision on morning.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { clashingSlots, slotsOccupied, productKey } from '@/domain/pricing.js';
import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const cow = (slot) => ({ slot, productName: 'cow milk' });
const buffalo = (slot) => ({ slot, productName: 'buffalo milk' });

describe('the rule itself', () => {
  it('knows which times a slot fills', () => {
    expect(slotsOccupied('MORNING')).toEqual(['MORNING']);
    expect(slotsOccupied('EVENING')).toEqual(['EVENING']);
    expect(slotsOccupied('BOTH')).toEqual(['MORNING', 'EVENING']);
    expect(() => slotsOccupied('ANYTIME')).toThrow(/Unknown delivery slot/);
  });

  it('treats a product name as the same however it is typed', () => {
    expect(productKey('  Cow Milk ')).toBe('cow milk');
    expect(productKey(null)).toBe('');
  });

  it.each([
    // Different product, same time — one visit carrying two things.
    [[cow('MORNING')], buffalo('MORNING'), []],
    [[cow('BOTH')], buffalo('MORNING'), []],
    [[cow('MORNING')], buffalo('BOTH'), []],
    // Same product, different time.
    [[cow('MORNING')], cow('EVENING'), []],
    [[], cow('BOTH'), []],
    // Same product, same time.
    [[cow('MORNING')], cow('MORNING'), ['MORNING']],
    [[cow('MORNING')], cow('BOTH'), ['MORNING']],
    [[cow('EVENING')], cow('BOTH'), ['EVENING']],
    [[cow('BOTH')], cow('MORNING'), ['MORNING']],
    [[cow('BOTH')], cow('BOTH'), ['MORNING', 'EVENING']],
    // Spelling is not identity.
    [[{ slot: 'MORNING', productName: 'Cow Milk ' }], cow('MORNING'), ['MORNING']],
  ])('held %j + %j -> clashes %j', (held, wanted, expected) => {
    expect(clashingSlots(held, wanted)).toEqual(expected);
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('subscribing alongside what you already have', () => {
  let db, sql, subscriptions, roles, milkmanId, fixture, actor;
  const planIds = [];

  async function makePlan(slot, productName) {
    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, evening_start, evening_end, price_per_delivery)
      values (${milkmanId}, ${`Slot Test ${productName} ${slot}`}, ${productName},
              '1.000', 'L', 'DAILY', ${slot},
              ${slot === 'EVENING' ? null : '06:00'}, ${slot === 'EVENING' ? null : '07:30'},
              ${slot === 'MORNING' ? null : '17:30'}, ${slot === 'MORNING' ? null : '19:00'},
              '50.00')
      returning id`);
    const id = (created.rows ?? created)[0].id;
    planIds.push(id);
    return id;
  }

  /*
   * A fresh customer per test.
   *
   * The app caps a customer at two active plans, so a suite that shares one
   * runs out of room before it has finished exercising the slot rule — and
   * fails on the cap rather than on the thing under test.
   */
  const made = [];
  async function freshCustomer(label) {
    const created = await createTestCustomer(db, sql, milkmanId, label);
    made.push(created.id);
    return { fixture: created, actor: customerActor(created, milkmanId, roles) };
  }

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    subscriptions = await import('@/services/subscription.service.js');

    const rows = await db.execute(sql`
      select id from "app".users where role = 'MILKMAN' limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;

    fixture = await createTestCustomer(db, sql, milkmanId, 'conflict');
    made.push(fixture.id);
    actor = customerActor(fixture, milkmanId, roles);
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of made) await removeTestCustomer(db, sql, id);
    for (const id of planIds) {
      await db.execute(sql`delete from "app".milk_plans where id = ${id}`);
    }
  });

  it('allows a different product at the same time', async () => {
    if (!milkmanId) return;
    await subscriptions.subscribe(actor, { planId: await makePlan('MORNING', 'cow milk') });

    // One visit, two bottles — the whole point of the change.
    const second = await subscriptions.subscribe(actor, {
      planId: await makePlan('MORNING', 'buffalo milk'),
    });
    expect(second.slot).toBe('MORNING');
  });

  it('allows the same product at a different time', async () => {
    if (!milkmanId) return;
    const { actor: mine } = await freshCustomer('same-product');
    await subscriptions.subscribe(mine, { planId: await makePlan('MORNING', 'goat milk') });

    const created = await subscriptions.subscribe(mine, {
      planId: await makePlan('EVENING', 'goat milk'),
    });
    expect(created.slot).toBe('EVENING');
  });

  it('refuses the same product at a time it already arrives', async () => {
    if (!milkmanId) return;
    const { actor: mine } = await freshCustomer('same-slot');
    await subscriptions.subscribe(mine, { planId: await makePlan('MORNING', 'cow milk') });

    await expect(
      subscriptions.subscribe(mine, { planId: await makePlan('MORNING', 'cow milk') }),
    ).rejects.toThrow(/already get cow milk in the morning/i);
  });

  it('refuses a both-slot plan when that product already has one of the times', async () => {
    if (!milkmanId) return;
    const { actor: mine } = await freshCustomer('both-slot');
    await subscriptions.subscribe(mine, { planId: await makePlan('MORNING', 'cow milk') });

    // Cow milk is already a morning delivery; BOTH needs morning as well.
    await expect(
      subscriptions.subscribe(mine, { planId: await makePlan('BOTH', 'cow milk') }),
    ).rejects.toThrow(/already get cow milk in the morning/i);
  });

  it('puts two products for one time on a single stop', async () => {
    if (!milkmanId) return;
    const delivery = await import('@/services/delivery.service.js');
    const { businessDate } = await import('@/domain/dates.js');
    const today = businessDate();

    // Start today so the generator has something to make.
    await db.execute(sql`
      update "app".milk_subscriptions set effective_from = ${today}
       where customer_id = ${fixture.id}`);
    await delivery.generateForDate(today);

    const milkman = {
      userId: milkmanId, clerkId: 'test', email: 't@t', name: 'Test',
      role: roles.ROLES.MILKMAN, tenantId: milkmanId, approvalStatus: null,
      isVerified: true, isActive: true,
      can: (p) => roles.roleHas(roles.ROLES.MILKMAN, p),
      scope: (p) => roles.scopeFor(roles.ROLES.MILKMAN, p),
    };

    const { stops, summary } = await delivery.getRound(milkman, today);
    const morning = stops.filter(
      (s) => s.customerId === fixture.id && s.slot === 'MORNING',
    );

    /*
     * One knock at the door. Rendered as two cards they read as a duplicate —
     * same name, same address, same time — which is the confusion two stops for
     * "morning & evening" caused before they were labelled.
     */
    expect(morning).toHaveLength(1);
    expect(morning[0].items.map((i) => i.productName).sort())
      .toEqual(['buffalo milk', 'cow milk']);

    // The header counts visits, so it agrees with the list beneath it.
    expect(summary.total).toBe(stops.length);
  });

  it('frees the time once the blocking plan is cancelled', async () => {
    if (!milkmanId) return;
    const mine = await subscriptions.listMine(actor);
    const blocking = mine.find(
      (s) => s.productName === 'cow milk' && s.status === 'ACTIVE',
    );
    await subscriptions.cancel(actor, { rootId: blocking.rootId, reason: 'test' });

    const created = await subscriptions.subscribe(actor, {
      planId: await makePlan('BOTH', 'cow milk'),
    });
    expect(created.slot).toBe('BOTH');
  });

  it('approves a second plan change on the same day', async () => {
    if (!milkmanId) return;
    const { transaction } = await import('@/db/index.js');
    const repo = await import('@/repositories/subscriptions.repo.js');
    const { businessDate } = await import('@/domain/dates.js');
    const today = businessDate();

    const milkman = {
      userId: milkmanId, clerkId: 'test', email: 't@t', name: 'Test',
      role: roles.ROLES.MILKMAN, tenantId: milkmanId, approvalStatus: null,
      isVerified: true, isActive: true,
      can: (p) => roles.roleHas(roles.ROLES.MILKMAN, p),
      scope: (p) => roles.scopeFor(roles.ROLES.MILKMAN, p),
    };

    const mine = await subscriptions.listMine(actor);
    const target = mine.find((s) => s.status === 'ACTIVE');
    if (!target) return;

    /*
     * A change takes effect tomorrow, so a second change the same day meets a
     * current version dated tomorrow that has delivered nothing. Closing it
     * "at the end of today" would end it the day before it began, which
     * `milk_subs_range` refuses — the milkman's Approve button simply failed.
     */
    const planA = await repo.findPlan(milkman, await makePlan('MORNING', 'change test milk'));
    await transaction((tx) =>
      subscriptions.applyPlanChange(tx, milkman, { rootId: target.rootId, plan: planA }));

    const planB = await repo.findPlan(milkman, await makePlan('MORNING', 'change test milk'));
    const second = await transaction((tx) =>
      subscriptions.applyPlanChange(tx, milkman, { rootId: target.rootId, plan: planB }));

    expect(second.planId).toBe(planB.id);
    // Amended in place, so no extra row for a version that never ran, and the
    // start date is still tomorrow rather than sliding a day further out.
    expect(second.effectiveFrom > today).toBe(true);

    const versions = await db.execute(sql`
      select count(*)::int as n from "app".milk_subscriptions
       where root_id = ${target.rootId} and effective_to is null`);
    expect((versions.rows ?? versions)[0].n).toBe(1);
  });

});
