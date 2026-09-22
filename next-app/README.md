# DairyDrop

Dairy delivery SaaS. Next.js App Router, JavaScript, role-based access control.

One application serves three audiences — **customer**, **milkman**, **admin** —
routed by role rather than deployed as three separate front ends.

> Rebuilt from the Express + 3×React-SPA original. The functional spec for that
> system, including every calculation and every defect this rebuild corrects,
> is in [`../docs/`](../docs/).

---

## Quick start

```bash
npm install
clerk init               # links the Clerk app and writes the two keys to .env
# then add DATABASE_URL and ADMIN_EMAILS to .env
npm run db:migrate       # create the schema
npm run db:seed          # optional: sample milkmen, customers, a month of history
npm run dev              # http://localhost:3000
```

Put your own email in `ADMIN_EMAILS` to get the admin role on first sign-in.

**Webhook (optional in development)** — dashboard.clerk.com → Webhooks → add an
endpoint at `https://<your-domain>/api/webhooks/clerk` subscribed to
`user.created`, `user.updated`, `user.deleted`, then copy the signing secret into
`CLERK_WEBHOOK_SIGNING_SECRET`. The app works without it: accounts are also
provisioned lazily on first request. The webhook is what keeps profile edits and
deletions in sync.

Test it locally with the Clerk CLI's tunnel:

```bash
clerk webhooks listen --token "$(clerk webhooks token)" \
  --forward-to http://localhost:3000/api/webhooks/clerk
```

```bash
npm test                 # the billing engine test suite
npm run db:studio        # browse the database
npm run jobs:deliveries  # generate today's deliveries by hand
```

---

## Architecture

Four layers, each depending only on the one below it. The rule that keeps it
honest: **a layer may not import from a layer above it**, and `domain/` imports
nothing at all.

```
  app/ · components/        Server components, Server Actions, UI
        │                   Thin. Parse, authorize, call a service, render.
        ▼
  src/services/             Use cases. Transactions, orchestration, notifications.
        │                   Knows nothing about HTTP.
        ▼
  src/repositories/         Data access. Every query is tenant-scoped or it
        │                   does not compile a query at all.
        ▼
  src/domain/               Pure business logic. Billing, pricing, dates, money.
                            No I/O, no framework, no database. Fully testable.
```

Cross-cutting:

| Directory | Holds |
|---|---|
| `src/auth/` | roles, permissions, scopes, account-state gates, session guards, Clerk↔database provisioning |
| `src/db/` | Drizzle schema, migrations, RLS policies, seed |
| `src/validation/` | Zod schemas, shared by forms and actions |
| `src/actions/` | the Server Action boundary |
| `src/jobs/` | scheduled work |

### Why JavaScript, and what replaces the type checker

No TypeScript, by request. Three things carry the load instead:

1. **Zod at every boundary** — every mutation parses its input against a schema
   before a service sees it. Types are checked where data actually enters.
2. **Database constraints** — enums, CHECK constraints, generated columns and
   partial unique indexes. `deliveries.amount` is computed by Postgres, so it
   cannot disagree with quantity × price whatever the application does.
3. **JSDoc** on every exported function, so editors still complete and warn.

---

## Role-based access control

Three concepts, kept separate:

| | Question it answers | Example |
|---|---|---|
| **Role** | Who are you? | `MILKMAN` |
| **Permission** | What action may you take? | `delivery:mark` |
| **Scope** | Whose rows may you touch? | `TENANT` |

The full matrix is `src/auth/roles.js` — one readable table, validated at module
load, so a typo or an over-grant fails immediately rather than at request time.

### Who owns what

**Clerk owns authentication.** Credentials, sessions, MFA, email verification,
the sign-in and sign-up UI. It has no idea what a milkman is.

**This app owns authorization.** Role, tenant and approval state live in the
`users` table, because they are relational — a customer's tenant is a foreign
key the database enforces, not a string in a metadata blob that can drift.

`users.clerkId` is the only thing joining the two. `src/auth/session.js` resolves
a verified Clerk id into the `ActorContext` that every layer below already
expected, which is why adopting Clerk touched two files rather than a hundred.

### Enforcement, in order

```
 1. middleware.js          Edge. Establishes the Clerk session and nothing else.
                           Deliberately does NO authorization — see below.

 2. Layout guards          Server. Resolve the real role from the database and
                           redirect. First line that actually decides anything.

 3. requirePermission()    Server. Every Server Action and Route Handler.
    requireMilkman()       This is the control. Actions are public HTTP
    requireCustomer()      endpoints and are callable directly.

 4. tenantFilter()         Every query is built from an actor. Passing no actor
                           throws; the filter cannot be forgotten.

 5. Row-level security     Postgres. `src/db/rls.sql` — independent of all of
                           the above, so an application bug leaks nothing.
```

Middleware does no authorization on purpose, which is also Clerk's own guidance:
`auth.protect()` and `createRouteMatcher` are deprecated because middleware
authorization relies on path matching, and path matching can diverge from how
Next.js actually routes a request. Resource-based checks — in the page, layout
or action that touches the data — cannot diverge, because they *are* the thing
touching the data.

Layers 3–5 are what the previous system lacked. Its SaaS paywall existed only in
React, so a milkman with an expired trial kept full API access.

### Account-state gates

Separate from permissions — these answer "may this account operate at all":

| Role | Gate |
|---|---|
| Customer | approved by their milkman |
| Milkman | business verified **and** subscription live |
| Admin | on the email allowlist |

Defined in `src/auth/policy.js` as pure functions, evaluated server-side, and
mapped to a screen that says precisely which gate is closed.

---

## The billing engine

`src/domain/billing.js` — one pure function, `computeBill`, that takes plain rows
and returns a complete bill. Both the customer invoice and the milkman earnings
screen call it, so the two reconcile **by construction**.

**The rule:** a customer pays for litres actually delivered. Skipped and
undelivered days cost nothing. Extras are added on top.

```js
computeBill({ month, deliveries, purchases, payments })
//  → { milkLines, productLines, totalPaise, paidPaise, balancePaise, status, … }
```

Three properties worth knowing:

- **Integer paise throughout.** Rupee floats accumulate error across a month;
  `0.1 + 0.2 !== 0.3`. Money is parsed to integers at the edge and formatted
  back at the edge.
- **Rates are frozen on the delivery row.** Each delivery carries its own
  `unitPrice`, stamped at generation time, so editing a plan cannot reprice a
  month that has already been delivered.
- **Rounded once, at the line.** `unitPrice` is carried at 4 decimal places
  (₹1800 ÷ 31 days is ₹58.0645) and rounded to paise only when a line amount is
  computed.

`npm test` covers 32 scenarios including the reconciliation property:

> *milkman earnings equal the sum of customer bills, to the paisa*

---

## Data model

20 tables, all in the **`app`** Postgres schema rather than `public`.

That matters when this runs against the same database as the original system,
which is the current setup: the old tables stay in `public`, untouched and still
serving users, while the rebuild lives beside them. Both define a `users` table
and they mean different things, so the separation is not cosmetic. The namespace
is declared once, in [`src/db/schema/_schema.js`](src/db/schema/_schema.js), and
every table, enum, foreign key and raw statement is emitted schema-qualified —
nothing depends on a `search_path`, which the Supabase transaction pooler
ignores. Tearing the rebuild down is `DROP SCHEMA app CASCADE`, with no way for
it to reach the old data.

The full corrected schema is documented in
[`../docs/02-data-model.md`](../docs/02-data-model.md); the differences from the
original that matter most:

| Change | Why |
|---|---|
| `saas_*` vs `milk_*` naming | two separate subscription systems used to sit one letter apart |
| Versioned subscriptions | a plan change closes one row and opens another, so a month spanning the change bills each part at the price in force |
| `UNIQUE (subscription_root_id, delivery_date)` | makes delivery generation idempotent and double-billing structurally impossible |
| `payments.bill_id NOT NULL` | a payment belongs to exactly one month and cannot be counted twice |
| `deliveries.amount` generated | the database computes it; it cannot drift from quantity × price |
| Postgres enums everywhere | the old CHECK constraints had drifted out of sync with the code in four places |
| `audit_log` | there was no way to answer "who suspended this milkman" |

---

## Scheduled jobs

`src/jobs/` — plain async functions with no scheduler baked in.

| Job | When | Does |
|---|---|---|
| `generate-deliveries` | daily, 00:05 IST | one row per active subscription, honouring `frequency` |
| `expire-subscriptions` | hourly | lapse subscriptions past `endsAt` — and nothing else |
| `remind-expiring` | daily | warn milkmen 3 days and 1 day out |
| `close-month` | 1st of the month | freeze last month's bills |
| `archive-notifications` | weekly | soft-delete anything over 90 days |

Run them three ways:

```bash
npm run jobs:deliveries                                    # CLI
node src/jobs/run.js backfill-deliveries --from 2026-09-01 --to 2026-09-05
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/generate-deliveries       # HTTP
```

`vercel.json` schedules all five. **Vercel cron runs in UTC** — `35 18 * * *` is
00:05 IST the next day.

Delivery generation is idempotent, so a retry or a double-fire is harmless.

---

## Deployment

1. Provision Postgres. Supabase, Neon and plain Postgres all work.
2. Set the environment from `.env.example`.
3. `npm run db:migrate`
4. Optionally apply `src/db/rls.sql` for defence in depth. It requires a
   non-owner database role; the file's header explains the setup.
5. In the Clerk dashboard, create a **production** instance, add your domain, and
   copy the production keys. `clerk doctor` will tell you if it is not configured.
6. Point the Clerk webhook at `https://<your-domain>/api/webhooks/clerk` and set
   `CLERK_WEBHOOK_SIGNING_SECRET`.
7. Deploy. Confirm the crons are firing.

---

## Conventions

- **Dates** are business dates in `APP_TIMEZONE` (Asia/Kolkata). Every date goes
  through `src/domain/dates.js`; no other module constructs a date string. The
  old system mixed UTC and IST, so the two halves disagreed about what day it
  was between midnight and 05:30 every night.
- **Money** is integer paise inside a calculation, decimal strings in the
  database, `formatPaise()` on screen.
- **Colour** comes from semantic tokens in `app/globals.css`, never raw palette
  values, so dark mode needs no `dark:` variants.
- **Server components by default.** `'use client'` only where there is genuine
  interactivity — which is why a page ships 1–3 kB of JavaScript.
- **Errors** are `DomainError` subclasses with a stable `code`, so the UI can
  branch on `CUSTOMER_LIMIT_REACHED` and offer an upgrade rather than a shrug.
