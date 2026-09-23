/**
 * One-day quantity changes.
 *
 * The exact amount a customer asks for has to survive to the milkman's round
 * and to the price. It did — but confirming the dialog without moving the
 * stepper wrote `adjusted_quantity = planned_quantity`, which flagged the stop
 * "changed today" and notified the milkman of a change that had not happened.
 * They then went looking for a difference that was not there.
 *
 * Fixtures are created and removed again.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const DATE = '2026-04-11';

suite('one-day quantity change', () => {
  let db, sql, delivery, customer, milkman, fixture, deliveryId;

  async function reload() {
    const result = await db.execute(sql`
      select planned_quantity, adjusted_quantity, delivered_quantity, amount, status
        from "app".deliveries where id = ${deliveryId}`);
    return (result.rows ?? result)[0];
  }

  async function resetToPending() {
    await db.execute(sql`
      update "app".deliveries
         set status = 'PENDING', adjusted_quantity = null,
             delivered_quantity = null, delivered_at = null
       where id = ${deliveryId}`);
  }

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    delivery = await import('@/services/delivery.service.js');

    const result = await db.execute(sql`
      select u.id, u.name, u.email, u.milkman_id,
             s.root_id, s.id as version_id, s.product_name, s.unit
        from "app".users u
        join "app".milk_subscriptions s
          on s.customer_id = u.id and s.effective_to is null
       where u.role = 'CUSTOMER' and u.milkman_id is not null
       limit 1`);
    fixture = (result.rows ?? result)[0];
    if (!fixture) return;

    const actorFor = (role, id, tenantId) => ({
      userId: id, clerkId: 'test', email: fixture.email, name: fixture.name, role,
      tenantId, approvalStatus: role === ROLES.CUSTOMER ? 'APPROVED' : null,
      isVerified: true, isActive: true,
      can: (p) => roleHas(role, p), scope: (p) => scopeFor(role, p),
    });
    customer = actorFor(ROLES.CUSTOMER, fixture.id, fixture.milkman_id);
    milkman = actorFor(ROLES.MILKMAN, fixture.milkman_id, fixture.milkman_id);

    await db.execute(sql`
      delete from "app".deliveries
       where customer_id = ${fixture.id} and delivery_date = ${DATE}`);

    const created = await db.execute(sql`
      insert into "app".deliveries
        (subscription_root_id, subscription_version_id, customer_id, milkman_id,
         delivery_date, slot, product_name, unit, planned_quantity, unit_price, status)
      values (${fixture.root_id}, ${fixture.version_id}, ${fixture.id}, ${fixture.milkman_id},
              ${DATE}, 'BOTH', ${fixture.product_name}, ${fixture.unit},
              '2.000', '30.0000', 'PENDING')
      returning id`);
    deliveryId = (created.rows ?? created)[0].id;
  });

  afterAll(async () => {
    if (!db || !deliveryId) return;
    await db.execute(sql`delete from "app".notifications where subject_id = ${deliveryId}`);
    await db.execute(sql`delete from "app".deliveries where id = ${deliveryId}`);
  });

  it('keeps a fractional amount exactly, and prices it', async () => {
    if (!fixture) return;
    await resetToPending();

    await delivery.adjustQuantity(customer, { deliveryId, quantity: '2.5' });
    expect(Number((await reload()).adjusted_quantity)).toBe(2.5);

    // The milkman taps "Delivered" without typing anything.
    await delivery.markDelivery(milkman, { deliveryId, status: 'DELIVERED' });

    const row = await reload();
    expect(Number(row.delivered_quantity)).toBe(2.5);
    expect(Number(row.amount)).toBe(75);        // 2.5 x 30, not 2 x 30
  });

  it('treats confirming the same amount as no change at all', async () => {
    if (!fixture) return;
    await resetToPending();

    const before = await db.execute(sql`
      select count(*)::int as n from "app".notifications
       where subject_id = ${deliveryId} and type = 'QUANTITY_CHANGE'`);

    // 2 is exactly what the plan already says.
    await delivery.adjustQuantity(customer, { deliveryId, quantity: '2' });

    // No redundant copy of the planned amount, so no "changed today" badge.
    expect((await reload()).adjusted_quantity).toBeNull();

    const after = await db.execute(sql`
      select count(*)::int as n from "app".notifications
       where subject_id = ${deliveryId} and type = 'QUANTITY_CHANGE'`);
    expect((after.rows ?? after)[0].n).toBe((before.rows ?? before)[0].n);
  });

  it('clears the adjustment when the customer goes back to their usual amount', async () => {
    if (!fixture) return;
    await resetToPending();

    await delivery.adjustQuantity(customer, { deliveryId, quantity: '3.5' });
    expect(Number((await reload()).adjusted_quantity)).toBe(3.5);

    await delivery.adjustQuantity(customer, { deliveryId, quantity: '2' });
    expect((await reload()).adjusted_quantity).toBeNull();
  });
});
