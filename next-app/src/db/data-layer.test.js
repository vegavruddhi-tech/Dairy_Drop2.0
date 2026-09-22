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

  beforeAll(async () => {
    const { ROLES, roleHas, scopeFor } = await import('@/auth/roles.js');
    const { businessMonth, businessDate } = await import('@/domain/dates.js');
    const { db } = await import('@/db/index.js');
    const { sql } = await import('drizzle-orm');

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

  describe('public', () => {
    it('serviceability finds a milkman for a served pincode', async () => {
      const result = await services.onboarding.findMilkmenForPincode('122003');
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
