/**
 * Limits on recording a payment.
 *
 * The balance check alone let a customer flood their milkman's queue three
 * ways: many ₹1 payments, several requests fired at once (each saw the whole
 * balance outstanding), and the same UTR over and over. These tests pin the
 * controls in `payment.service.submit`.
 *
 * Borrows one live customer and works in a month with no real data, removing
 * everything it wrote in afterAll. Skipped without DATABASE_URL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const MONTH = '2026-02';
const DATE = '2026-02-14';

suite('payment submission limits', () => {
  let db, sql, payment, actor, customerId, subscribed;

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    payment = await import('@/services/payment.service.js');

    const result = await db.execute(sql`
      select u.id, u.name, u.email, u.milkman_id,
             s.root_id, s.id as version_id, s.product_name, s.unit
        from "app".users u
        join "app".milk_subscriptions s
          on s.customer_id = u.id and s.effective_to is null
       where u.role = 'CUSTOMER' and u.milkman_id is not null
       limit 1`);
    const row = (result.rows ?? result)[0];
    subscribed = Boolean(row);
    if (!subscribed) return;

    customerId = row.id;
    actor = {
      userId: row.id, clerkId: 'test', email: row.email, name: row.name,
      role: ROLES.CUSTOMER, tenantId: row.milkman_id, approvalStatus: 'APPROVED',
      isVerified: true, isActive: true,
      can: (p) => roleHas(ROLES.CUSTOMER, p),
      scope: (p) => scopeFor(ROLES.CUSTOMER, p),
    };

    await cleanup();
    // 4 L at ₹30 delivered: the month owes ₹120.
    await db.execute(sql`
      insert into "app".deliveries
        (subscription_root_id, subscription_version_id, customer_id, milkman_id,
         delivery_date, slot, product_name, unit, planned_quantity,
         delivered_quantity, delivered_at, unit_price, status)
      values (${row.root_id}, ${row.version_id}, ${row.id}, ${row.milkman_id},
              ${DATE}, 'BOTH', ${row.product_name}, ${row.unit}, '4.000',
              '4.000', now(), '30.0000', 'DELIVERED')
      on conflict do nothing`);
    await ageAllPayments();
  });

  const bills = () => sql`(select id from "app".monthly_bills where customer_id = ${customerId} and month = ${MONTH})`;

  async function cleanup() {
    if (!customerId) return;
    await db.execute(sql`delete from "app".notifications where subject_type = 'payment'
      and subject_id in (select id from "app".payments where bill_id in ${bills()})`);
    await db.execute(sql`delete from "app".payments where bill_id in ${bills()}`);
    await db.execute(sql`delete from "app".monthly_bills where customer_id = ${customerId} and month = ${MONTH}`);
    await db.execute(sql`delete from "app".deliveries where customer_id = ${customerId} and delivery_date = ${DATE}`);
  }

  /** Step past the cooldown without sleeping: push every payment by this customer back two minutes. */
  async function ageAllPayments() {
    await db.execute(sql`update "app".payments set created_at = created_at - interval '2 minutes'
      where customer_id = ${customerId}`);
  }

  async function countRows() {
    const r = await db.execute(sql`select count(*)::int as n from "app".payments where bill_id in ${bills()}`);
    return (r.rows ?? r)[0].n;
  }

  const pay = (amount, reference) =>
    payment.submit(actor, { month: MONTH, amount: String(amount), method: 'UPI', reference });

  afterAll(async () => {
    if (db && subscribed) await cleanup();
  });

  it('refuses more than is owed', async () => {
    if (!subscribed) return;
    await expect(pay(500, 'LIM-OVER')).rejects.toThrow(/you owe/i);
    expect(await countRows()).toBe(0);
  });

  it('makes a customer wait between submissions', async () => {
    if (!subscribed) return;
    await pay(40, 'LIM-A');
    await expect(pay(10, 'LIM-B')).rejects.toThrow(/wait/i);
    expect(await countRows()).toBe(1);
  });

  it('refuses a reference that is already recorded', async () => {
    if (!subscribed) return;
    await ageAllPayments();
    await expect(pay(10, ' lim-a ')).rejects.toThrow(/already been recorded/i);
  });

  it('holds at most two unconfirmed payments per bill', async () => {
    if (!subscribed) return;
    await pay(10, 'LIM-B');
    await ageAllPayments();
    await expect(pay(10, 'LIM-C')).rejects.toThrow(/still confirming/i);
    expect(await countRows()).toBe(2);
  });

  it('lets exactly one of two simultaneous submissions through', async () => {
    if (!subscribed) return;
    await db.execute(sql`delete from "app".notifications where subject_type = 'payment'
      and subject_id in (select id from "app".payments where bill_id in ${bills()})`);
    await db.execute(sql`delete from "app".payments where bill_id in ${bills()}`);
    await ageAllPayments();

    const results = await Promise.allSettled([pay(120, 'LIM-P1'), pay(120, 'LIM-P2')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await countRows()).toBe(1);
  });
});
