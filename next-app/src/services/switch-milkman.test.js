/**
 * Switching to another milkman.
 *
 * Failed for everyone who had a milkman: the notification to the one they
 * were leaving used the type 'CUSTOMER_REMOVED', which the enum does not have.
 * And for a customer whose old milkman's account was deleted, the dues check
 * and that notification pointed rows at a user who no longer exists.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createTestCustomer, removeTestCustomer, customerActor } from '@/test/customer-fixture.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('switching milkman', () => {
  let db, sql, roles, onboarding, target, oldMilkmanId, fixture, ready = false;

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ sql } = await import('drizzle-orm'));
    roles = await import('@/auth/roles.js');
    onboarding = await import('@/services/onboarding.service.js');

    // A verified milkman with a service area to move to, and a different one to leave.
    const t = await db.execute(sql`
      select a.milkman_id, a.pincode, a.area_name
        from "app".service_areas a
        join "app".milkman_profiles p on p.milkman_id = a.milkman_id and p.is_verified
       where a.is_active limit 1`);
    target = (t.rows ?? t)[0];
    if (!target) return;
    const o = await db.execute(sql`
      select id from "app".users where role = 'MILKMAN' and id <> ${target.milkman_id} limit 1`);
    oldMilkmanId = (o.rows ?? o)[0]?.id;
    if (!oldMilkmanId) return;
    try {
      await onboarding.assertCanAcceptCustomer(target.milkman_id);
    } catch {
      return;
    }
    fixture = await createTestCustomer(db, sql, oldMilkmanId, 'switchmm');
    ready = true;
  });

  afterAll(async () => {
    if (!db || !fixture) return;
    await db.execute(sql`delete from "app".notifications where subject_id = ${fixture.id}`);
    await removeTestCustomer(db, sql, fixture.id);
  });

  it('moves the customer to the new milkman and tells the old one', async () => {
    if (!ready) return;
    const actor = customerActor(fixture, oldMilkmanId, roles);
    await onboarding.switchMilkman(actor, {
      newMilkmanId: target.milkman_id,
      pincode: target.pincode,
      area: target.area_name,
      planIds: [],
    });

    const u = await db.execute(sql`select milkman_id, approval_status from "app".users where id = ${fixture.id}`);
    expect((u.rows ?? u)[0]).toMatchObject({ milkman_id: target.milkman_id, approval_status: 'PENDING' });

    const n = await db.execute(sql`
      select type from "app".notifications where subject_id = ${fixture.id} and user_id = ${oldMilkmanId}`);
    expect((n.rows ?? n).map((r) => r.type)).toEqual(['SYSTEM']);
  });

  it('works when the old milkman account no longer exists', async () => {
    if (!ready) return;
    // The session still carries the deleted milkman's id, as it did for the
    // customer who reported this.
    const ghost = customerActor(fixture, '00000000-0000-0000-0000-00000000dead', roles);
    await db.execute(sql`update "app".users set milkman_id = null where id = ${fixture.id}`);
    await expect(
      onboarding.switchMilkman(ghost, {
        newMilkmanId: target.milkman_id,
        pincode: target.pincode,
        area: target.area_name,
        planIds: [],
      }),
    ).resolves.toEqual({ ok: true });
  });
});
