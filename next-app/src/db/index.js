/**
 * Database client.
 *
 * One pooled connection, reused across hot reloads in development (Next.js
 * re-evaluates modules on every edit, which would otherwise leak a pool per save).
 *
 * `server-only` makes importing this from a client component a build error
 * rather than a runtime surprise — the connection string must never reach a bundle.
 */

import 'server-only';

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from './schema/index.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill it in — there is no fallback.',
  );
}

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    /*
     * Keep the pool small, recycle idle clients quickly.
     *
     * The ceiling that matters is the *pooler's*, not this process's. Supabase's
     * session pooler allows 15 client connections for the whole project, shared
     * by every instance: several serverless instances, or a dev server and a
     * test run on one laptop, are all drawing on the same 15.
     *
     * The default used to be 10, so two consumers exhausted it and Postgres
     * started refusing connections with EMAXCONNSESSION. That surfaces as a
     * Server Component throwing mid-render, which in development takes the
     * whole page down with it.
     *
     * Five leaves room for a second consumer. Raise it with DATABASE_POOL_MAX
     * only after checking what the pooler actually allows.
     */
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Supabase and most managed Postgres require TLS but present a chain Node
    // does not ship a root for.
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });
}

const globalForDb = globalThis;

export const pool = globalForDb.__dairydropPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalForDb.__dairydropPool = pool;

export const db = drizzle(pool, {
  schema,
  logger: process.env.DB_LOGGING === 'true',
});

export { schema };

/**
 * Run `fn` inside a transaction.
 *
 * Every write that touches more than one table goes through here. The previous
 * system had none — approving a plan change wrote three tables with no atomicity,
 * so a failure halfway left the customer on a plan they had not agreed to.
 *
 * @template T
 * @param {(tx: typeof db) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function transaction(fn) {
  return db.transaction(fn);
}
