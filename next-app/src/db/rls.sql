-- ============================================================================
-- Row-level security — the second line of defence.
--
-- The application already scopes every query through `src/repositories/base.js`,
-- which refuses to build a query without an actor. This file makes the database
-- enforce the same rule independently, so a bug in the application layer leaks
-- nothing.
--
-- The previous system had neither: it connected with Supabase's service-role
-- key (which bypasses RLS entirely) and defined zero policies, so isolation
-- between milkmen rested on remembering `.eq('milkman_id', …)` roughly 150 times.
--
-- ── How to use ──────────────────────────────────────────────────────────────
--
-- 1. Create a role for the application that is NOT the owner and NOT a superuser:
--
--      CREATE ROLE dairydrop_app LOGIN PASSWORD '…';
--      GRANT USAGE ON SCHEMA app TO dairydrop_app;
--      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO dairydrop_app;
--      ALTER DEFAULT PRIVILEGES IN SCHEMA app
--        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dairydrop_app;
--
--    Point DATABASE_URL at that role. A table owner bypasses RLS unless you also
--    run `ALTER TABLE … FORCE ROW LEVEL SECURITY`, which is why the app must not
--    connect as the owner.
--
-- 2. Set the request context at the start of every transaction:
--
--      SET LOCAL app.user_id   = '<uuid>';
--      SET LOCAL app.tenant_id = '<uuid or empty>';
--      SET LOCAL app.role      = 'CUSTOMER' | 'MILKMAN' | 'ADMIN';
--
--    `SET LOCAL` is scoped to the transaction, so a pooled connection cannot
--    carry one request's identity into the next.
--
-- 3. Run this file.
-- ============================================================================

-- Every statement below names a table unqualified, and this database also
-- carries the previous system's tables in `public` — including its own
-- `users`, `deliveries` and `subscriptions`. Without this line, running the
-- file would enable and FORCE row-level security on *those* tables instead,
-- locking the old application out of its own data with no policy to let it
-- back in. Unlike a search path set in the connection string, which the
-- transaction pooler ignores, this is executed by the script itself.
set search_path = app;

-- ── Context helpers ─────────────────────────────────────────────────────────

create or replace function app_user_id() returns uuid
  language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function app_tenant_id() returns uuid
  language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function app_role() returns text
  language sql stable as $$
  select coalesce(nullif(current_setting('app.role', true), ''), 'NONE')
$$;

create or replace function app_is_admin() returns boolean
  language sql stable as $$
  select app_role() = 'ADMIN'
$$;

-- ============================================================================
-- Policies
--
-- Each table gets one permissive policy per role that may touch it. An
-- administrator is unrestricted; a milkman sees their own tenant; a customer
-- sees only their own rows.
-- ============================================================================

-- ── users ───────────────────────────────────────────────────────────────────
alter table users enable row level security;
alter table users force row level security;

create policy users_admin on users
  using (app_is_admin()) with check (app_is_admin());

create policy users_self on users
  using (id = app_user_id()) with check (id = app_user_id());

-- A milkman sees the customers in their own book.
create policy users_tenant on users
  using (app_role() = 'MILKMAN' and milkman_id = app_tenant_id())
  with check (app_role() = 'MILKMAN' and milkman_id = app_tenant_id());

-- ── milkman_profiles ────────────────────────────────────────────────────────
alter table milkman_profiles enable row level security;
alter table milkman_profiles force row level security;

create policy profiles_admin on milkman_profiles
  using (app_is_admin()) with check (app_is_admin());

create policy profiles_self on milkman_profiles
  using (milkman_id = app_user_id()) with check (milkman_id = app_user_id());

-- A customer may read their own milkman's profile — it carries the UPI details
-- they need in order to pay. Read only.
create policy profiles_customer_read on milkman_profiles
  for select using (app_role() = 'CUSTOMER' and milkman_id = app_tenant_id());

-- ── addresses ───────────────────────────────────────────────────────────────
alter table addresses enable row level security;
alter table addresses force row level security;

create policy addresses_admin on addresses
  using (app_is_admin()) with check (app_is_admin());

create policy addresses_own on addresses
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- A milkman reads the addresses on their round.
create policy addresses_tenant_read on addresses
  for select using (
    app_role() = 'MILKMAN'
    and exists (
      select 1 from users u
       where u.id = addresses.user_id and u.milkman_id = app_tenant_id()
    )
  );

-- ── service_areas ───────────────────────────────────────────────────────────
alter table service_areas enable row level security;
alter table service_areas force row level security;

create policy areas_admin on service_areas
  using (app_is_admin()) with check (app_is_admin());

create policy areas_owner on service_areas
  using (milkman_id = app_user_id()) with check (milkman_id = app_user_id());

-- Coverage is public information — the signup screen needs it before anyone has
-- an account.
create policy areas_public_read on service_areas
  for select using (is_active);

-- ============================================================================
-- Tenant-scoped tables
--
-- Identical shape for every table with a `milkman_id` and a `customer_id`, so
-- it is generated rather than written out eighteen times.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'milk_subscriptions',
    'deliveries',
    'purchases',
    'monthly_bills',
    'payments',
    'quantity_change_requests',
    'plan_change_requests'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format(
      'create policy %I on %I using (app_is_admin()) with check (app_is_admin())',
      t || '_admin', t
    );

    execute format(
      'create policy %I on %I
         using (app_role() = ''MILKMAN'' and milkman_id = app_tenant_id())
         with check (app_role() = ''MILKMAN'' and milkman_id = app_tenant_id())',
      t || '_tenant', t
    );

    execute format(
      'create policy %I on %I
         using (app_role() = ''CUSTOMER'' and customer_id = app_user_id())
         with check (app_role() = ''CUSTOMER'' and customer_id = app_user_id())',
      t || '_own', t
    );
  end loop;
end $$;

-- ── milk_plans / products ───────────────────────────────────────────────────
-- Owned by a milkman; readable by their customers so they can subscribe and buy.

do $$
declare
  t text;
begin
  foreach t in array array['milk_plans', 'products']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format(
      'create policy %I on %I using (app_is_admin()) with check (app_is_admin())',
      t || '_admin', t
    );

    execute format(
      'create policy %I on %I
         using (app_role() = ''MILKMAN'' and milkman_id = app_user_id())
         with check (app_role() = ''MILKMAN'' and milkman_id = app_user_id())',
      t || '_owner', t
    );

    execute format(
      'create policy %I on %I for select
         using (app_role() = ''CUSTOMER'' and milkman_id = app_tenant_id() and is_active)',
      t || '_customer_read', t
    );
  end loop;
end $$;

-- ── SaaS layer ──────────────────────────────────────────────────────────────
alter table saas_subscriptions enable row level security;
alter table saas_subscriptions force row level security;

create policy saas_subs_admin on saas_subscriptions
  using (app_is_admin()) with check (app_is_admin());

create policy saas_subs_own on saas_subscriptions
  using (milkman_id = app_user_id()) with check (milkman_id = app_user_id());

alter table saas_payments enable row level security;
alter table saas_payments force row level security;

create policy saas_payments_admin on saas_payments
  using (app_is_admin()) with check (app_is_admin());

create policy saas_payments_own on saas_payments
  for select using (milkman_id = app_user_id());

-- Plans and platform settings are public reads; only an administrator writes.
alter table saas_plans enable row level security;
alter table saas_plans force row level security;
create policy saas_plans_read on saas_plans for select using (true);
create policy saas_plans_admin on saas_plans
  using (app_is_admin()) with check (app_is_admin());

alter table platform_settings enable row level security;
alter table platform_settings force row level security;
create policy settings_read on platform_settings for select using (true);
create policy settings_admin on platform_settings
  using (app_is_admin()) with check (app_is_admin());

-- ── notifications ───────────────────────────────────────────────────────────
-- Addressed to exactly one person. No tenant dimension at all.
alter table notifications enable row level security;
alter table notifications force row level security;

create policy notifications_own on notifications
  using (user_id = app_user_id()) with check (user_id = app_user_id());

create policy notifications_admin on notifications
  using (app_is_admin()) with check (app_is_admin());

-- ── audit_log ───────────────────────────────────────────────────────────────
-- Append-only, administrator-readable. No UPDATE or DELETE policy exists, so
-- neither is possible for any role — that is the point of an audit log.
alter table audit_log enable row level security;
alter table audit_log force row level security;

create policy audit_read on audit_log for select using (app_is_admin());
create policy audit_append on audit_log for insert with check (true);

-- ── admin_allowlist ─────────────────────────────────────────────────────────
alter table admin_allowlist enable row level security;
alter table admin_allowlist force row level security;

create policy allowlist_admin on admin_allowlist
  using (app_is_admin()) with check (app_is_admin());

-- Sign-in must check the allowlist before a role exists, so reads are open.
-- The table holds email addresses only — no secrets.
create policy allowlist_read on admin_allowlist for select using (true);
