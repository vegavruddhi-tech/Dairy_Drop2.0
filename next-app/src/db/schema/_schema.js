/**
 * The Postgres schema every table and enum in this rebuild lives in.
 *
 * ## Why not `public`
 *
 * The database already holds the previous system's 26 tables in `public`, and
 * that system is still serving users. Putting the rebuild in its own namespace
 * means the two coexist on one database with no chance of a name collision —
 * both have a `users` table, both have `subscriptions`, and they mean different
 * things. The old app keeps working untouched; this one can be dropped and
 * rebuilt with a single `DROP SCHEMA app CASCADE` without endangering it.
 *
 * ## Why it is declared here rather than in the connection string
 *
 * A `search_path` on the DSN would also route unqualified `CREATE TABLE`s here,
 * but drizzle-kit writes foreign-key targets and enum types *schema-qualified*
 * — it emits `REFERENCES "public"."users"` regardless of the search path. The
 * result is a table in `app` whose foreign keys point at `public`. Declaring
 * the namespace in the schema definition is the only place that reaches the
 * generator, so the emitted SQL says `"app"."users"` throughout.
 *
 * Every schema file imports `pgTable` and `pgEnum` from here instead of from
 * `drizzle-orm/pg-core`. The call signatures are identical, so nothing else in
 * those files changes.
 */

import { pgSchema } from 'drizzle-orm/pg-core';

/** The namespace itself. `drizzle-kit` emits `CREATE SCHEMA "app"` for it. */
export const appSchema = pgSchema('app');

/** Drop-in replacement for `pgTable`, bound to the `app` namespace. */
export const pgTable = appSchema.table;

/** Drop-in replacement for `pgEnum`, bound to the `app` namespace. */
export const pgEnum = appSchema.enum;

/** The bare name, for raw SQL and the migration bookkeeping table. */
export const APP_SCHEMA = appSchema.schemaName;
