/**
 * Signing up with a chosen quantity.
 *
 * At registration the customer now picks how much of each plan; the request
 * waits as PENDING at that amount and price, and approving the customer opens
 * it. Skips itself when the test milkman has no verified profile or no room
 * under their customer limit, since both are preconditions of registering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('registering with a chosen quantity', () => {
  let db, sql, roles, onboarding, fixture, customer, milkman, milkmanId, planId, ready = false;

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    onboarding = await import('@/services/onboarding.service.js');

    const rows = await db.execute(sql`
      select u.id from "app".users u
        join "app".milkman_profiles p on p.milkman_id = u.id
       where u.role = 'MILKMAN' and p.is_verified = true
       limit 1`);
    milkmanId = (rows.rows ?? rows)[0]?.id;
    if (!milkmanId) return;
    try {
      await onboarding.assertCanAcceptCustomer(milkmanId);
    } catch {
      return; // no room under the milkman's limit; nothing to test against
    }

    milkman = {
      userId: milkmanId, clerkId: 'test', email: 't@dairydrop.test', name: 'Test',
      role: roles.ROLES.MILKMAN, tenantId: milkmanId, approvalStatus: null, isVerified: true, isActive: true,
      can: (p) => roles.roleHas(roles.ROLES.MILKMAN, p),
      scope: (p) => roles.scopeFor(roles.ROLES.MILKMAN, p),
    };

    fixture = await createTestCustomer(db, sql, milkmanId, 'regqty');
    // Registering is for someone not yet attached to a milkman.
    await db.execute(sql`update "app".users set milkman_id = null, approval_status = null where id = ${fixture.id}`);
    customer = { ...customerActor(fixture, null, roles), tenantId: null, approvalStatus: null };

    const created = await db.execute(sql`
      insert into "app".milk_plans
        (milkman_id, name, product_name, quantity, unit, frequency, slot,
         morning_start, morning_end, price_per_delivery, is_active)
      values (${milkmanId}, 'RegQty Cow', 'regqty cow milk', '1.000', 'L', 'DAILY', 'MORNING',
              '06:00', '07:30', '70.00', true)
      returning id`);
    planId = (created.rows ?? created)[0].id;
    ready = true;
  });

  afterAll(async () => {
    if (!db) return;
    if (fixture?.id) await db.execute(sql`delete from "app".addresses where user_id = ${fixture.id}`);
    await removeTestCustomer(db, sql, fixture?.id);
    if (planId) await db.execute(sql`delete from "app".milk_plans where id = ${planId}`);
  });

  it('records the chosen litres as a waiting request, priced from the rate', async () => {
    if (!ready) return;
    await onboarding.register(customer, {
      milkmanId, name: 'RegQty Test', phone: '9876543210', area: 'RegQty Sector',
      pincode: '122001', line1: 'Flat 1', planIds: [planId], quantities: { [planId]: '1.5' },
    });

    const rows = await db.execute(sql`
      select status, quantity, unit_price, quoted_monthly_price
        from "app".milk_subscriptions where customer_id = ${fixture.id}`);
    const [sub] = rows.rows ?? rows;
    expect(sub.status).toBe('PENDING');
    expect(Number(sub.quantity)).toBe(1.5);
    expect(Number(sub.unit_price)).toBe(70);
    expect(Number(sub.quoted_monthly_price) % 105).toBe(0); // 1.5 L × ₹70 per drop
  });

  it('approving the customer opens the plan', async () => {
    if (!ready) return;
    await onboarding.approveCustomer(milkman, { customerId: fixture.id });
    const rows = await db.execute(sql`
      select status from "app".milk_subscriptions where customer_id = ${fixture.id}`);
    expect((rows.rows ?? rows).map((r) => r.status)).toEqual(['ACTIVE']);
  });
});
