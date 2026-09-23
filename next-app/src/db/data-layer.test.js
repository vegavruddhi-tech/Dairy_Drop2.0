/**
 * Integration tests for the data layer behind every page.
 *
 * `next build` proves the pages compile; it cannot prove a query works. These
 * call the same services each page calls, with real actors against real rows,
 * so a wrong column, a bad join or a null dereference fails here rather than in
 * front of a user.
 *
 * Requires a migrated, seeded database. Skipped when DATABASE_URL is unset.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('data layer', () => {
  let admin, milkman, customer, month, today;
  let services;
  // Hoisted: tests below build raw statements too, not just the setup.
  let sql;

  beforeAll(async () => {
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    const { businessMonth, businessDate } = await import('@/domain/dates.js');
    const { db } = await import('@/db/index.js');
    ({ sql } = await import('drizzle-orm'));

    month = businessMonth();
    today = businessDate();

    /** The same ActorContext shape the guards hand to every layer below. */
    const actorFor = (row) => ({
      userId: row.id,
      clerkId: row.clerk_id,
      email: row.email,
      name: row.name,
      role: row.role,
      tenantId: row.role === ROLES.MILKMAN ? row.id : (row.milkman_id ?? null),
      approvalStatus: row.approval_status,
      isVerified: true,
      isActive: row.is_active,
      can: (p) => roleHas(row.role, p),
      scope: (p) => scopeFor(row.role, p),
    });

    const result = await db.execute(sql`
      select id, clerk_id, email, name, role, milkman_id, approval_status, is_active
        from "app".users
       where role in ('ADMIN','MILKMAN','CUSTOMER')
       order by role, created_at
    `);
    const rows = result.rows ?? result;

    admin = actorFor(rows.find((r) => r.role === 'ADMIN'));
    milkman = actorFor(rows.find((r) => r.role === 'MILKMAN'));
    customer = actorFor(
      rows.find((r) => r.role === 'CUSTOMER' && r.approval_status === 'APPROVED'),
    );

    services = {
      delivery: await import('@/services/delivery.service.js'),
      billing: await import('@/services/billing.service.js'),
      product: await import('@/services/product.service.js'),
      payment: await import('@/services/payment.service.js'),
      subscription: await import('@/services/subscription.service.js'),
      request: await import('@/services/request.service.js'),
      saas: await import('@/services/saas.service.js'),
      admin: await import('@/services/admin.service.js'),
      onboarding: await import('@/services/onboarding.service.js'),
      usersRepo: await import('@/repositories/users.repo.js'),
      subsRepo: await import('@/repositories/subscriptions.repo.js'),
      reqRepo: await import('@/repositories/requests.repo.js'),
      billRepo: await import('@/repositories/billing.repo.js'),
      saasRepo: await import('@/repositories/saas.repo.js'),
      db,

      /**
       * A pincode some verified, unsuspended milkman actually covers, or null.
       * Mirrors the conditions `findMilkmenForPincode` itself filters on.
       */
      async coveredPincode() {
        const result = await db.execute(sql`
          select sa.pincode
            from "app".service_areas sa
            join "app".users u on u.id = sa.milkman_id
            join "app".milkman_profiles p on p.milkman_id = sa.milkman_id
           where sa.is_active
             and u.is_active
             and p.is_verified
             and p.suspended_at is null
           limit 1
        `);
        return (result.rows ?? result)[0]?.pincode ?? null;
      },
    };
  });

  describe('customer panel', () => {
    it('/dashboard loads today, the bill, the catalog and the milkman', async () => {
      const [day, bill, catalog, milkmanInfo] = await Promise.all([
        services.delivery.getCustomerDay(customer, today),
        services.billing.getBill(customer, { month }),
        services.product.listForCustomer(customer),
        services.usersRepo.findMilkmanPaymentInfo(customer.tenantId),
      ]);
      expect(day.deliveries).toBeInstanceOf(Array);
      expect(bill.totalPaise).toBeTypeOf('number');
      expect(catalog).toBeInstanceOf(Array);
      expect(milkmanInfo?.businessName).toBeTruthy();
    });

    it('/shop loads the catalog and past orders', async () => {
      expect(await services.product.listForCustomer(customer)).toBeInstanceOf(Array);
      expect(await services.product.listMyOrders(customer, { limit: 20 })).toBeInstanceOf(Array);
    });

    it('/billing loads payment info and invoice history', async () => {
      expect(await services.payment.getPaymentInfo(customer)).toBeTruthy();
      expect(await services.billing.listInvoices(customer, { limit: 12 })).toBeInstanceOf(Array);
    });

    it('/subscriptions loads plans, subscriptions and requests', async () => {
      expect(await services.subscription.listMine(customer)).toBeInstanceOf(Array);
      expect(await services.subscription.listAvailablePlans(customer)).toBeInstanceOf(Array);
      expect(await services.reqRepo.listMyPlanChangeRequests(customer, { limit: 10 })).toBeInstanceOf(Array);
    });

    it('/calendar loads a month of deliveries', async () => {
      expect(await services.delivery.getMonth(customer, { month })).toBeInstanceOf(Array);
    });

    it('/profile loads the customer and their address', async () => {
      const row = await services.usersRepo.findCustomer(customer, customer.userId);
      expect(row?.email).toBe(customer.email);
    });
  });

  describe('milkman panel', () => {
    it('/milkman loads the round, earnings and every badge count', async () => {
      const [round, earnings, requests, pending, count, submitted] = await Promise.all([
        services.delivery.getRound(milkman, today),
        services.billing.getEarnings(milkman, { month }),
        services.reqRepo.countPendingRequests(milkman),
        services.usersRepo.countPendingCustomers(milkman),
        services.subsRepo.countActiveCustomers(services.db, milkman.userId),
        services.billRepo.countSubmitted(milkman),
      ]);
      expect(round.stops).toBeInstanceOf(Array);
      expect(round.summary.total).toBeTypeOf('number');
      expect(earnings.billedPaise).toBeTypeOf('number');
      expect(requests.total).toBeTypeOf('number');
      expect(pending).toBeTypeOf('number');
      expect(count).toBeTypeOf('number');
      expect(submitted).toBeTypeOf('number');
    });

    it('/milkman/customers loads both tabs and the subscription summary', async () => {
      const approved = await services.usersRepo.listCustomers(milkman, { status: 'APPROVED' });
      expect(approved.length).toBeGreaterThan(0);
      expect(await services.usersRepo.listCustomers(milkman, { status: 'PENDING' })).toBeInstanceOf(Array);
      const summary = await services.subsRepo.summariseByCustomer(milkman, approved.map((c) => c.id));
      expect(summary).toBeInstanceOf(Map);
    });

    it('/milkman/requests loads the inbox', async () => {
      const inbox = await services.request.listInbox(milkman);
      expect(inbox.quantity).toBeInstanceOf(Array);
      expect(inbox.plan).toBeInstanceOf(Array);
    });

    it('/milkman/orders loads each status', async () => {
      for (const status of ['PENDING', 'ACCEPTED', 'DELIVERED']) {
        expect(await services.product.listOrders(milkman, { status })).toBeInstanceOf(Array);
      }
    });

    it('/milkman/catalog and /milkman/plans load', async () => {
      expect(await services.product.listCatalog(milkman)).toBeInstanceOf(Array);
      expect(await services.subsRepo.listPlans(milkman)).toBeInstanceOf(Array);
    });

    it('/milkman/payments loads the queue and outstanding balances', async () => {
      expect(await services.payment.listPending(milkman, { limit: 50 })).toBeInstanceOf(Array);
      expect(await services.payment.listOutstanding(milkman, { limit: 50 })).toBeInstanceOf(Array);
    });

    it('/milkman/membership loads the subscription state', async () => {
      const m = await services.saas.getMembership(milkman);
      expect(m.plans.length).toBeGreaterThan(0);
      expect(m.access).toHaveProperty('ok');
    });
  });

  describe('admin panel', () => {
    it('/admin loads KPIs and the plan distribution', async () => {
      const stats = await services.admin.getDashboard();
      expect(stats.milkmen).toBeGreaterThan(0);
      expect(await services.admin.getPlanDistribution()).toBeInstanceOf(Array);
    });

    it('every admin list query runs', async () => {
      expect(await services.admin.listMilkmen({ limit: 50 })).toBeInstanceOf(Array);
      expect(await services.admin.listVerifications()).toBeInstanceOf(Array);
      expect(await services.admin.listPlans()).toBeInstanceOf(Array);
      expect(await services.admin.listPayments({ limit: 50 })).toBeInstanceOf(Array);
      expect(await services.admin.listAuditLog({ limit: 50 })).toBeInstanceOf(Array);
      expect(await services.admin.getSettings()).toBeTruthy();
      expect(await services.saasRepo.listPendingVerifications()).toBeInstanceOf(Array);
    });
  });

  describe('payments', () => {
    /*
     * Guards the two bugs that made the milkman's "I received this" button dead.
     * Both lived in `recalculatePaidAmount`, and both only fired on a real
     * verification, which is why nothing else caught them:
     *
     *   42804 — the bill status is derived with a CASE over string literals,
     *           typed `text`, assigned to the `bill_status` enum column.
     *   22P02 — `sum()` returns a decimal string, and comparing the bound
     *           parameter against the literal 0 made Postgres infer it as
     *           integer, so '60.00' failed to parse.
     *
     * The second only appears once a payment is actually VERIFIED and the total
     * is not a whole number, so the test creates that state itself — inside a
     * transaction it then rolls back, so the suite never settles a real bill.
     */
    it('recalculates a decimal paid total onto the enum status', async () => {
      const result = await services.db.execute(
        sql`select id, customer_id, milkman_id, total_amount
              from "app".monthly_bills limit 1`,
      );
      const bill = (result.rows ?? result)[0];
      if (!bill) return;

      // Relative to whatever this bill has already been paid — the absolute
      // figure depends on live rows, and asserting on it made this test fail
      // the moment a real payment was verified.
      const before = await services.db.execute(sql`
        select coalesce(sum(amount) filter (where status = 'VERIFIED'), 0)::text as paid
          from "app".payments where bill_id = ${bill.id}`);
      const alreadyPaid = Number((before.rows ?? before)[0].paid);

      const ROLLBACK = Symbol('rollback');
      let updated = null;

      await expect(
        services.db.transaction(async (tx) => {
          // A verified payment with paise, which is what broke the comparison.
          await tx.execute(sql`
            insert into "app".payments
              (bill_id, customer_id, milkman_id, amount, method, status)
            values (${bill.id}, ${bill.customer_id}, ${bill.milkman_id},
                    '60.50', 'UPI', 'VERIFIED')
          `);

          updated = await services.billRepo.recalculatePaidAmount(tx, bill.id);
          throw ROLLBACK;
        }),
      ).rejects.toBe(ROLLBACK);

      expect(updated).toBeTruthy();
      // Enum round-tripped, not text.
      expect(['OPEN', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])
        .toContain(updated.status);
      // The paise survived rather than being truncated or rejected.
      expect(Number(updated.paidAmount)).toBeCloseTo(alreadyPaid + 60.5, 2);
    });
  });

  describe('earnings', () => {
    /*
     * Guards a bug where "Collected" fell as customers paid.
     *
     * The figure was summed from `listOutstanding`, which returns only bills
     * that still owe money — so settling a bill in full removed it from the
     * list and subtracted that customer's payment from the milkman's takings.
     * With everyone paid up it read ₹0 while the money was in the bank.
     *
     * Collections are a fact about payments, so the check is against payments.
     */
    it('collected equals verified payments for the month', async () => {
      const earnings = await services.billing.getEarnings(milkman, { month });

      const expected = await services.db.execute(sql`
        select coalesce(sum(p.amount) filter (where p.status = 'VERIFIED'), 0)::text as verified,
               count(*)::int as total
          from "app".payments p
          join "app".monthly_bills b on b.id = p.bill_id
         where p.milkman_id = ${milkman.userId} and b.month = ${month}`);
      const row = (expected.rows ?? expected)[0];

      expect(earnings.collectedPaise).toBe(Math.round(Number(row.verified) * 100));
      // Never negative, even when a customer has paid in advance.
      expect(earnings.outstandingPaise).toBe(
        Math.max(0, earnings.billedPaise - earnings.collectedPaise),
      );
      expect(earnings.outstandingPaise).toBeGreaterThanOrEqual(0);
    });

    it('returns the month payment history the earnings page lists', async () => {
      const earnings = await services.billing.getEarnings(milkman, { month });
      expect(earnings.payments).toBeInstanceOf(Array);
      for (const payment of earnings.payments) {
        expect(payment.customerName).toBeTruthy();
        expect(payment.amountPaise).toBeTypeOf('number');
        expect(['SUBMITTED', 'VERIFIED', 'REJECTED']).toContain(payment.status);
      }
    });
  });

  describe('public', () => {
    /*
     * Read the pincode out of the database rather than hardcoding one.
     *
     * This used to assert on '122003', a pincode that only existed because the
     * sample seed created it. Re-seeding, or clearing the samples to use real
     * accounts, made a green test go red while serviceability itself was fine.
     * The behaviour under test is "a covered pincode resolves to its milkman",
     * which does not depend on which pincode that is.
     */
    it('serviceability finds a milkman for a served pincode', async () => {
      const covered = await services.coveredPincode();
      if (!covered) {
        expect(await services.onboarding.findMilkmenForPincode('122003'))
          .toMatchObject({ serviceable: false });
        return;
      }

      const result = await services.onboarding.findMilkmenForPincode(covered);
      expect(result.serviceable).toBe(true);
      expect(result.milkmen.length).toBeGreaterThan(0);
    });

    it('rejects a malformed pincode', async () => {
      await expect(services.onboarding.findMilkmenForPincode('abc')).rejects.toThrow();
    });
  });

  describe('tenant isolation', () => {
    it('a customer cannot read another milkman\'s plans', async () => {
      const foreign = { ...customer, tenantId: admin.userId };
      expect(await services.subsRepo.listPlansForCustomer(foreign)).toHaveLength(0);
    });

    it('a query built without an actor is refused', async () => {
      const { tenantFilter } = await import('@/repositories/base.js');
      const { PERMISSIONS } = await import('@/auth/roles.js');
      expect(() =>
        tenantFilter({ actor: null, permission: PERMISSIONS.DELIVERY_READ, columns: {} }),
      ).toThrow();
    });
  });
});
