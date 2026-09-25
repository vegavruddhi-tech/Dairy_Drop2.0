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
  const isProd = process.env.NODE_ENV === 'production';
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    // In serverless production (Vercel), limit connections per lambda instance to avoid exceeding pooler limits
    max: Number(process.env.DATABASE_POOL_MAX ?? (isProd ? 1 : 5)),
    idleTimeoutMillis: isProd ? 1_000 : 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });

  p.on('error', (err) => {
    console.error('Unexpected error on idle pg client', err);
  });

  return p;
}

const globalForDb = globalThis;

export const pool = globalForDb.__dairydropPool ?? createPool();
// Cache pool on globalThis across invocations in both dev and serverless production
globalForDb.__dairydropPool = pool;

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
