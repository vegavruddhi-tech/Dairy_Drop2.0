/**
 * The milkman application pipeline.
 *
 * This is the path that was missing entirely: the code documented that a
 * milkman is provisioned deliberately rather than self-served, but nothing
 * performed the provisioning. Anyone signing up to sell became a CUSTOMER stuck
 * on PENDING, and no application ever reached an administrator.
 *
 * Requires a migrated, seeded database. Skipped when DATABASE_URL is unset.
 *
 * Every raw statement below names the `app` schema explicitly. The database
 * also holds the previous system's tables in `public`, including its own
 * `users` — an unqualified `delete from users` here would resolve by search
 * path, and a search path is a connection-string setting that the transaction
 * pooler silently ignores. Qualifying the names is what stops a test run from
 * deleting live rows out of the old application.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('milkman application', () => {
  let db, sql, users, milkmanProfiles, serviceAreas;
  let onboarding, adminService, roles;
  let applicantId;

  const APPLICANT_EMAIL = 'applicant.test@dairydrop.example';

  /** An ActorContext shaped exactly as the guards produce one. */
  function actorFor(row) {
    return {
      userId: row.id,
      clerkId: row.clerk_id ?? 'user_test',
      email: row.email,
      name: row.name,
      role: row.role,
      tenantId: row.role === 'MILKMAN' ? row.id : (row.milkman_id ?? null),
      approvalStatus: row.approval_status,
      isVerified: false,
      isActive: true,
      can: (p) => roles.roleHas(row.role, p),
      scope: (p) => roles.scopeFor(row.role, p),
    };
  }

  async function reload(id) {
    const result = await db.execute(sql`
      select u.id, u.clerk_id, u.email, u.name, u.role, u.milkman_id,
             u.approval_status, u.phone,
             p.business_name, p.is_verified
        from "app".users u
        left join "app".milkman_profiles p on p.milkman_id = u.id
       where u.id = ${id}
    `);
    return (result.rows ?? result)[0];
  }

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    ({ users, milkmanProfiles, serviceAreas } = await import('@/db/schema/index.js'));
    onboarding = await import('@/services/onboarding.service.js');
    adminService = await import('@/services/admin.service.js');
    roles = await import('@/auth/roles.js');

    // A fresh account, exactly as Clerk would have provisioned it.
    await db.execute(sql`delete from "app".users where email = ${APPLICANT_EMAIL}`);
    const created = await db.execute(sql`
      insert into "app".users (email, name, role, approval_status, is_active, clerk_id)
      values (${APPLICANT_EMAIL}, 'Test Applicant', 'CUSTOMER', 'PENDING', true, 'user_test_applicant')
      returning id
    `);
    applicantId = (created.rows ?? created)[0].id;
  });

  afterAll(async () => {
    if (applicantId) await db.execute(sql`delete from "app".users where id = ${applicantId}`);
  });

  it('a new Google sign-up starts as a pending CUSTOMER', async () => {
    const row = await reload(applicantId);
    expect(row.role).toBe('CUSTOMER');
    expect(row.approval_status).toBe('PENDING');
    // This is the state the reporter was stuck in.
  });

  it('applying promotes them to MILKMAN, unverified', async () => {
    const actor = actorFor(await reload(applicantId));

    await onboarding.applyToBecomeMilkman(actor, {
      businessName: 'Test Dairy Co',
      phone: '9812345678',
      businessAddress: '12 Test Lane',
      upiId: 'test@upi',
      areaName: 'Test Sector',
      pincode: '110001',
      city: 'Delhi',
      state: 'Delhi',
    });

    const row = await reload(applicantId);
    expect(row.role).toBe('MILKMAN');
    expect(row.business_name).toBe('Test Dairy Co');
    // Unverified is the application: the gate keeps them out until an admin acts.
    expect(row.is_verified).toBe(false);
    // Customer-side fields are cleared — their tenant is now themselves.
    expect(row.approval_status).toBeNull();
    expect(row.milkman_id).toBeNull();
  });

  it('captures a service area, so a customer can actually find them', async () => {
    const result = await db.execute(sql`
      select area_name, pincode from "app".service_areas where milkman_id = ${applicantId}
    `);
    const areas = result.rows ?? result;
    expect(areas).toHaveLength(1);
    expect(areas[0].pincode).toBe('110001');
  });

  it('THE BUG: the application now reaches the admin queue', async () => {
    const pending = await adminService.listMilkmen({ verified: false, limit: 100 });
    const found = pending.find((m) => m.id === applicantId);

    expect(found).toBeDefined();
    expect(found.businessName).toBe('Test Dairy Co');
    expect(found.isVerified).toBe(false);
  });

  it('the badge count includes it', async () => {
    const count = await onboarding.countPendingMilkmanApplications();
    expect(count).toBeGreaterThan(0);
  });

  it('applying twice is refused rather than duplicating', async () => {
    const actor = actorFor(await reload(applicantId));
    await expect(
      onboarding.applyToBecomeMilkman(actor, {
        businessName: 'Test Dairy Co',
        phone: '9812345678',
        areaName: 'Test Sector',
        pincode: '110001',
        city: 'Delhi',
        state: 'Delhi',
      }),
    ).rejects.toThrow(/already applied/i);
  });

  it('an admin verifying them opens the panel', async () => {
    const adminRow = (
      await db.execute(sql`select * from "app".users where role = 'ADMIN' limit 1`)
    );
    const admin = actorFor((adminRow.rows ?? adminRow)[0]);

    await adminService.verifyMilkman(admin, { milkmanId: applicantId });

    const row = await reload(applicantId);
    expect(row.is_verified).toBe(true);

    // And they leave the queue.
    const stillPending = await adminService.listMilkmen({ verified: false, limit: 100 });
    expect(stillPending.find((m) => m.id === applicantId)).toBeUndefined();
  });

  it('the whole journey is recorded in the audit log', async () => {
    const entries = await adminService.listAuditLog({ limit: 20 });
    const entry = entries.find(
      (e) => e.action === 'MILKMAN_VERIFIED' && e.subjectId === applicantId,
    );
    expect(entry).toBeDefined();
    expect(entry.actorEmail).toBeTruthy();
  });
});
