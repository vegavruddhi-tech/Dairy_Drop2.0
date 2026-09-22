/**
 * Verify the database connection and report what is actually there.
 *
 *   npm run db:check
 *
 * Exists because the most common way to misconfigure this app is to paste a
 * Supabase *API* credential where a *Postgres* one belongs. They are different
 * things and the resulting error is opaque, so this says plainly what is wrong.
 */

import 'dotenv/config';
import pg from 'pg';

import { APP_SCHEMA } from './schema/_schema.js';

const { Pool } = pg;
const url = process.env.DATABASE_URL;

function fail(headline, detail) {
  console.error(`\n  ✗ ${headline}\n`);
  if (detail) console.error(detail.split('\n').map((l) => `    ${l}`).join('\n') + '\n');
  process.exit(1);
}

if (!url) {
  fail('DATABASE_URL is not set.', 'Copy .env.example to .env and fill it in.');
}

// The mistake this script exists to catch.
if (url.startsWith('https://')) {
  fail(
    'DATABASE_URL is an HTTPS URL, not a Postgres connection string.',
    'SUPABASE_URL (https://<ref>.supabase.co) is the REST API endpoint, and\n' +
      'SUPABASE_SERVICE_ROLE_KEY is a JWT for that API. Neither can open a\n' +
      'Postgres connection.\n\n' +
      'This app talks to Postgres directly, because it relies on transactions,\n' +
      'generated columns and partial unique indexes that the REST API cannot\n' +
      'express.\n\n' +
      'Get the real connection string from:\n' +
      '  Supabase dashboard → Project Settings → Database → Connection string → URI',
  );
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  fail('DATABASE_URL does not look like a Postgres connection string.',
       'It should start with postgresql://');
}

if (/\[YOUR-PASSWORD\]|\[PASSWORD\]|<password>/i.test(url)) {
  fail('DATABASE_URL still contains the password placeholder.',
       'Replace it with your database password — Supabase dashboard →\n' +
       'Project Settings → Database → Reset database password, if you do not have it.');
}

const host = url.replace(/^postgres(ql)?:\/\/[^@]*@/, '').split(/[:/]/)[0];
const isLocal = /localhost|127\.0\.0\.1/.test(host);
const isPooler = host.includes('pooler.supabase.com');

console.log('\n  Connecting…');
console.log(`    host   ${host}`);
console.log(`    mode   ${isLocal ? 'local' : isPooler ? 'Supabase pooler' : 'direct'}`);

const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 15_000,
});

try {
  const { rows: [info] } = await pool.query(
    'select current_database() as db, version() as version',
  );
  console.log(`    ✓ connected to "${info.db}"`);
  console.log(`      ${info.version.split(',')[0]}\n`);

  /*
   * Report every schema, not just ours.
   *
   * This database may also hold the previous system's tables in `public`. Both
   * have a `users` table meaning different things, so a count that does not say
   * *which* schema it counted is worse than no count at all — it is how you end
   * up reading the old data and believing the rebuild is seeded.
   */
  const { rows: schemas } = await pool.query(
    `select table_schema as schema, count(*)::int as tables
       from information_schema.tables
      where table_schema not in ('pg_catalog', 'information_schema')
        and table_type = 'BASE TABLE'
      group by table_schema
      order by table_schema`,
  );

  const { rows: [{ path }] } = await pool.query(
    `select current_setting('search_path') as path`,
  );
  console.log(`  search_path: ${path}`);

  for (const s of schemas) {
    const mine = s.schema === APP_SCHEMA ? '  ← this app' : '';
    console.log(`    ${s.schema.padEnd(10)} ${String(s.tables).padStart(3)} tables${mine}`);
  }
  console.log();

  const app = schemas.find((s) => s.schema === APP_SCHEMA);
  if (!app) {
    console.log(`  Schema "${APP_SCHEMA}" does not exist.`);
    console.log('  Run `npm run db:migrate`, then `npm run db:seed`.\n');
    process.exit(0);
  }

  // Row counts for the tables that tell you whether a seed has run. Qualified
  // explicitly so the answer does not depend on the search path.
  const tables = ['users', 'milkman_profiles', 'milk_plans', 'milk_subscriptions',
                  'deliveries', 'products', 'saas_plans', 'saas_subscriptions'];
  let seeded = 0;
  for (const table of tables) {
    try {
      const { rows: [r] } = await pool.query(
        `select count(*)::int as n from "${APP_SCHEMA}"."${table}"`,
      );
      seeded += r.n;
      console.log(`    ${APP_SCHEMA}.${table.padEnd(20)} ${String(r.n).padStart(5)}`);
    } catch {
      console.log(`    ${APP_SCHEMA}.${table.padEnd(20)}     — missing`);
    }
  }
  if (seeded === 0) console.log('\n  Tables exist but are empty. Run `npm run db:seed`.');
  console.log();
} catch (error) {
  const hints = {
    '28P01': 'The password is wrong. Supabase dashboard → Project Settings →\nDatabase → Reset database password.',
    ENOTFOUND: 'That host does not resolve. Check the connection string was copied whole.',
    ETIMEDOUT:
      'Connection timed out. Supabase disables direct IPv4 on new projects — use\n' +
      'the Session pooler string (aws-0-<region>.pooler.supabase.com:5432) instead\n' +
      'of db.<ref>.supabase.co.',
    ECONNREFUSED: 'Nothing is listening there. Check the host and port.',
  };
  fail(`Could not connect: ${error.message}`, hints[error.code]);
} finally {
  await pool.end();
}
