/**
 * A disposable customer for integration tests.
 *
 * Tests used to borrow whichever customer happened to be in the database. That
 * worked until the rules got stricter — one delivery per time of day means a
 * borrowed customer usually already holds the slot the test wants, so the test
 * failed on a rule it was not testing. It also made tests sensitive to whatever
 * the live data happened to look like that day.
 *
 * Each caller gets its own customer, and removes it again.
 */

/**
 * Create an approved customer belonging to `milkmanId`.
 *
 * @param {object} db   the drizzle client
 * @param {Function} sql  drizzle's `sql` tag
 * @param {string} milkmanId
 * @param {string} [label]  distinguishes fixtures within one suite
 * @returns {Promise<{ id: string, email: string, name: string }>}
 */
export async function createTestCustomer(db, sql, milkmanId, label = 'fixture') {
  const email = `test.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@dairydrop.test`;
  const name = `Test ${label}`;

  const result = await db.execute(sql`
    insert into "app".users (email, name, role, approval_status, milkman_id, is_active)
    values (${email}, ${name}, 'CUSTOMER', 'APPROVED', ${milkmanId}, true)
    returning id`);

  return { id: (result.rows ?? result)[0].id, email, name };
}

/**
 * Remove a fixture customer and everything hanging off them.
 *
 * Ordered by foreign key: deliveries and payments reference the subscription
 * and bill rows that reference the user.
 */
export async function removeTestCustomer(db, sql, customerId) {
  if (!customerId) return;
  await db.execute(sql`delete from "app".deliveries where customer_id = ${customerId}`);
  await db.execute(sql`delete from "app".purchases where customer_id = ${customerId}`);
  await db.execute(sql`delete from "app".payments where customer_id = ${customerId}`);
  await db.execute(sql`delete from "app".monthly_bills where customer_id = ${customerId}`);
  await db.execute(sql`delete from "app".milk_subscriptions where customer_id = ${customerId}`);
  await db.execute(sql`delete from "app".notifications where user_id = ${customerId}`);
  await db.execute(sql`delete from "app".users where id = ${customerId}`);
}

/** The ActorContext shape the guards hand to every layer below. */
export function customerActor({ id, email, name }, milkmanId, roles) {
  const { ROLES, roleHas, scopeFor } = roles;
  return {
    userId: id,
    clerkId: 'test',
    email,
    name,
    role: ROLES.CUSTOMER,
    tenantId: milkmanId,
    approvalStatus: 'APPROVED',
    isVerified: true,
    isActive: true,
    can: (p) => roleHas(ROLES.CUSTOMER, p),
    scope: (p) => scopeFor(ROLES.CUSTOMER, p),
  };
}

/** Remove every fixture customer, whoever created them. */
export async function removeStaleTestCustomers(db, sql) {
  const result = await db.execute(sql`
    select id from "app".users where email like '%@dairydrop.test'`);
  for (const row of result.rows ?? result) {
    await removeTestCustomer(db, sql, row.id);
  }
}
