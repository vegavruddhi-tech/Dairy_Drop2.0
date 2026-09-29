/**
 * Signing up again with an email whose account is bound to another Clerk id.
 *
 * Used to throw a bare Error from inside `getActor`, which made every page a
 * 500. Now: an orphan (the old Clerk user is gone) is rebound and reopened; a
 * live conflict raises AccountConflictError, which the session turns into
 * /account-locked. Clerk is not called — `identityExists` is injected.
 *
 * Requires a migrated database; every row made here is deleted in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite('re-signup with an email bound to another Clerk id', () => {
  let db, users, eq, upsertFromClerk, AccountConflictError;
  const made = [];

  beforeAll(async () => {
    ({ db } = await import('@/db/index.js'));
    ({ users } = await import('@/db/schema/index.js'));
    ({ eq } = await import('drizzle-orm'));
    ({ upsertFromClerk } = await import('@/auth/provision.js'));
    ({ AccountConflictError } = await import('@/domain/errors.js'));
  });

  afterEach(async () => {
    while (made.length) await db.delete(users).where(eq(users.id, made.pop()));
  });

  async function existingRow({ clerkId, isActive = true }) {
    const email = `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@dairydrop.test`;
    const [row] = await db
      .insert(users)
      .values({ clerkId, email, name: 'Conflict test', role: 'CUSTOMER', approvalStatus: 'APPROVED', isActive })
      .returning();
    made.push(row.id);
    return row;
  }

  const fresh = () => `user_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  it('rebinds the row when the old Clerk user no longer exists', async () => {
    const row = await existingRow({ clerkId: fresh() });
    const newId = fresh();
    const account = await upsertFromClerk(
      { clerkId: newId, email: row.email, name: 'Back again' },
      { identityExists: async () => false },
    );
    expect(account.id).toBe(row.id);
    expect(account.clerkId).toBe(newId);
  });

  it('refuses when the old Clerk user still exists', async () => {
    const row = await existingRow({ clerkId: fresh() });
    await expect(
      upsertFromClerk({ clerkId: fresh(), email: row.email }, { identityExists: async () => true }),
    ).rejects.toBeInstanceOf(AccountConflictError);

    const [after] = await db.select().from(users).where(eq(users.id, row.id));
    expect(after.clerkId).toBe(row.clerkId);
  });

  it('reopens an account that the user.deleted webhook deactivated', async () => {
    const row = await existingRow({ clerkId: null, isActive: false });
    const account = await upsertFromClerk({ clerkId: fresh(), email: row.email }, { identityExists: async () => false });
    expect(account.id).toBe(row.id);
    expect(account.isActive).toBe(true);
  });
});
