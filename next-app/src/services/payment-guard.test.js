/**
 * Paying a month that owes nothing.
 *
 * The customer's billing screen used to offer the payment form whatever the
 * balance was, and `submit` only checked that the amount was positive — so a
 * settled month could be paid again and again. Each one put a row in the
 * milkman's confirmation queue and, once confirmed, became a credit nobody
 * had actually paid.
 *
 * The form is now hidden when nothing is due, but the form is not the control:
 * a Server Action is a public HTTP endpoint. These tests exercise the service.
 *
 * Requires a migrated database. Skipped when DATABASE_URL is unset. Every row
 * created here is removed again in `afterAll`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

/** A month with no real data in it, so the fixtures cannot disturb live bills. */
const MONTH = '2026-03';
const DATE = '2026-03-15';

suite('paying a settled month', () => {
  let db, sql, payment, billing, actor, customerId, milkmanId, subscribed;

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    payment = await import('@/services/payment.service.js');
    billing = await import('@/services/billing.service.js');

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
    milkmanId = row.milkman_id;
    actor = {
      userId: row.id, clerkId: 'test', email: row.email, name: row.name,
      role: ROLES.CUSTOMER, tenantId: row.milkman_id, approvalStatus: 'APPROVED',
      isVerified: true, isActive: true,
      can: (p) => roleHas(ROLES.CUSTOMER, p),
      scope: (p) => scopeFor(ROLES.CUSTOMER, p),
    };

    await cleanup();

    // One delivered day, so the month genuinely owes something.
    // `delivered_at` is required alongside DELIVERED by a CHECK constraint.
    await db.execute(sql`
      insert into "app".deliveries
        (subscription_root_id, subscription_version_id, customer_id, milkman_id,
         delivery_date, slot, product_name, unit, planned_quantity,
         delivered_quantity, delivered_at, unit_price, status)
      values (${row.root_id}, ${row.version_id}, ${row.id}, ${row.milkman_id},
              ${DATE}, 'BOTH', ${row.product_name}, ${row.unit}, '2.000',
              '2.000', now(), '30.0000', 'DELIVERED')
      on conflict do nothing`);
  });

  async function cleanup() {
    if (!customerId) return;
    await db.execute(sql`
      delete from "app".payments where bill_id in
        (select id from "app".monthly_bills
          where customer_id = ${customerId} and month = ${MONTH})`);
    await db.execute(sql`
      delete from "app".monthly_bills
       where customer_id = ${customerId} and month = ${MONTH}`);
    await db.execute(sql`
      delete from "app".deliveries
       where customer_id = ${customerId} and delivery_date = ${DATE}`);
  }

  afterAll(async () => {
    if (!db || !subscribed) return;
    await db.execute(sql`
      delete from "app".notifications where subject_type = 'payment'
        and subject_id in (select id from "app".payments where bill_id in
          (select id from "app".monthly_bills
            where customer_id = ${customerId} and month = ${MONTH}))`);
    await cleanup();
  });

  it('accepts a payment for a month that owes money', async () => {
    if (!subscribed) return;
    const bill = await billing.getBill(actor, { month: MONTH });
    expect(bill.balancePaise).toBeGreaterThan(0);

    const created = await payment.submit(actor, {
      month: MONTH, amount: '60', method: 'UPI', reference: 'TEST-OWED',
    });
    expect(created?.id).toBeTruthy();
  });

  it('refuses a second payment while the first is still awaiting confirmation', async () => {
    if (!subscribed) return;
    await expect(
      payment.submit(actor, {
        month: MONTH, amount: '60', method: 'UPI', reference: 'TEST-DUPLICATE',
      }),
    ).rejects.toThrow(/already recorded/i);

    // And no row was written for the refused attempt.
    const rows = await db.execute(sql`
      select count(*)::int as n from "app".payments p
        join "app".monthly_bills b on b.id = p.bill_id
       where b.customer_id = ${customerId} and b.month = ${MONTH}`);
    expect((rows.rows ?? rows)[0].n).toBe(1);
  });

  it('refuses a payment once the month is fully settled', async () => {
    if (!subscribed) return;
    // Confirm the outstanding payment, which settles the bill.
    await db.execute(sql`
      update "app".payments set status = 'VERIFIED', verified_at = now()
       where bill_id in (select id from "app".monthly_bills
                          where customer_id = ${customerId} and month = ${MONTH})`);

    const bill = await billing.getBill(actor, { month: MONTH });
    expect(bill.balancePaise).toBe(0);

    await expect(
      payment.submit(actor, {
        month: MONTH, amount: '25', method: 'UPI', reference: 'TEST-SETTLED',
      }),
    ).rejects.toThrow(/nothing left to pay/i);
  });
});
