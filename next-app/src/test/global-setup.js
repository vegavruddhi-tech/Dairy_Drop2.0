/**
 * Sweep leftover fixtures once, before any test file runs.
 *
 * Integration tests create approved customers, and an approved customer counts
 * against their milkman's plan limit. A run that crashes before its `afterAll`
 * leaves one behind, and enough of those take the milkman to their ceiling —
 * at which point they are correctly no longer offered to new customers, and a
 * serviceability test that has nothing to do with fixtures starts failing.
 *
 * Cleaning up inside `createTestCustomer` was not enough: it only fires when a
 * fixture is first created, so a file that runs earlier still saw the debris.
 * Doing it here makes the starting state the same however the files are
 * ordered.
 *
 * Skipped without DATABASE_URL, like the suites it serves.
 */

import 'dotenv/config';
import pg from 'pg';

const CHILD_TABLES = [
  'deliveries',
  'purchases',
  'payments',
  'monthly_bills',
  'milk_subscriptions',
];

export async function setup() {
  if (!process.env.DATABASE_URL) return;

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const { rows } = await pool.query(
      `select id from "app".users where email like '%@dairydrop.test'`,
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      // Ordered by foreign key: the child rows reference the user.
      for (const table of CHILD_TABLES) {
        await pool.query(`delete from "app".${table} where customer_id = $1`, [row.id]);
      }
      await pool.query(`delete from "app".notifications where user_id = $1`, [row.id]);
      await pool.query(`delete from "app".users where id = $1`, [row.id]);
    }
    console.log(`[test] swept ${rows.length} leftover fixture customer(s)`);
  } finally {
    await pool.end();
  }
}
