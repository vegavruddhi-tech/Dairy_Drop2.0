# 10. Rebuild Guide

How to build this again, and what to decide before you start.

---

## 10.1 What to keep

The domain model is sound. These are real insights about the business — don't redesign them away:

- **Usage-based billing.** Customers pay for litres actually delivered, not days subscribed.
  Skipped days genuinely cost nothing. This is the product's fairness promise.
- **Delivery-as-billing-atom.** One row per subscription per day, carrying its own quantity and
  price. Everything reconciles from it.
- **Customer limits as the monetisation lever.** Tiering on customer count (not features)
  matches how a milkman actually grows.
- **Offline-first payments.** UTR + manual verification reflects how money really moves in this
  market. Online payment is a nice-to-have, not the core.
- **Two-sided approval.** The milkman approves their customers; the admin approves the milkman.
- **Snapshot-on-write.** `product_name`, `quantity`, `monthly_price` and the flattened address
  are copied onto subscriptions, deliveries and purchases at creation. Later edits don't rewrite
  history. Keep this everywhere money is involved.
- **The `COMMON_DAIRY_PRESETS` catalog.** One-tap "add all standard dairy items" is excellent
  onboarding for a non-technical vendor.
- **Multi-language, mobile-first, PWA.** Right call for the market — just implement i18n properly.
- **Separate admin storage keys.** Lets an operator hold an admin session and a test customer
  session in one browser.

## 10.2 What to discard

- 27 dead pages (~8,000 lines).
- The Mongoose models and the `mongoose` dependency.
- `daily_product_orders`, `additional_orders`, `milkman_products`, `milkman_notifications`,
  and probably `delivery_routes`.
- All 11 endpoint alias groups.
- Every duplicate column pair.
- The `resolve_plan_change_request` RPC (keep the application implementation).
- The dev-only debug routes.
- `client-customer` / `client-milkman` `vite.config.js`, `App.jsx`, `main.jsx`, stock READMEs.

---

## 10.3 Recommended stack

The existing split of **one API + three SPAs** is the right shape — three distinct users with
almost no UI overlap. Keep it, but put them in one workspace.

### Recommendation

| Layer | Choice | Why |
|---|---|---|
| **Monorepo** | pnpm workspaces + Turborepo | one lockfile; a real `packages/shared` fixes MAINT-3 |
| **Language** | TypeScript everywhere, strict | already is |
| **API** | **NestJS** or **Fastify + tRPC** | see below |
| **Database** | **PostgreSQL** (Supabase or Neon) | the model is relational; keep it |
| **Data access** | **Drizzle ORM** | typed SQL, real migrations, easy aggregates |
| **Validation** | **Zod**, shared client↔server | ~200 hand-rolled validations today |
| **Auth** | **Auth.js** or **Lucia** + Google provider | short access token + refresh, not 7-day JWTs |
| **Frontend** | React 19 + Vite + TanStack Router | keep React; the team knows it |
| **Server state** | **TanStack Query** | replaces ~all polling and manual `useState` fetch code |
| **Client state** | Zustand (auth only) | already fine |
| **Styling** | Tailwind + shadcn/ui | keep Tailwind; stop hand-rolling components |
| **i18n** | **i18next** + `react-i18next` | with a lint rule banning literal JSX strings |
| **Jobs** | **pg-boss** (Postgres-backed) | delivery generation, expiry, billing — no extra infra |
| **Realtime** | Supabase Realtime, or SSE | kills 16 polling loops |
| **Testing** | Vitest + Supertest + Playwright | at minimum, billing has unit tests |
| **Errors** | Sentry + pino | replaces 199 `console.log`s |

### API framework: pick one

**NestJS** if you want structure enforced. Modules/services/repositories give you the layer that
4,267-line route files are missing, DI makes billing testable, and decorators handle the
auth/tenancy guards declaratively. Cost: boilerplate, and a learning curve.

**Fastify + tRPC** if you want speed and end-to-end type safety. Since all three clients are
TypeScript React apps you own, tRPC eliminates the entire API-contract drift problem — the
`token`/`credential` bug becomes a compile error, and so do all 17 dead frontend calls. Cost:
harder to expose a public REST API later.

Given that all three consumers are first-party TS apps and contract drift caused several of the
bugs in [09](09-known-defects.md), **tRPC is the better fit**. Use NestJS if you expect a mobile
app or third-party integrations soon.

### Alternative: Next.js for everything

Three Next apps (or one with route groups) with server components and server actions would cut a
lot of plumbing. Reasonable — but the three apps genuinely need separate deploys, origins and
PWA manifests, and offline-capable PWAs are the one thing Next makes harder. **Recommend against**
for this product.

---

## 10.4 Architecture

```
apps/
  api/                     Fastify + tRPC + Drizzle
    src/modules/
      auth/  identity/  tenancy/
      subscriptions/         customer milk plans
      deliveries/            generation, status, round view
      billing/               ← THE critical module, unit-tested
      products/              catalog + purchases
      payments/              customer ↔ milkman
      saas/                  platform plans, milkman subscriptions, UTR verification
      notifications/
    src/jobs/                pg-boss: generate-deliveries, expire-subscriptions, close-month
  web-customer/
  web-milkman/
  web-admin/
packages/
  shared/                  Zod schemas, types, constants, money + date helpers
  ui/                      shared React components (ends the triplication)
  db/                      Drizzle schema + migrations
```

<a id="tenancy"></a>

### Tenancy

Pick **one** mechanism and make it impossible to bypass:

**Option A — RLS (defence in depth).** Connect as a non-superuser, set
`SET LOCAL app.current_user_id` / `app.current_tenant_id` per request, and write policies:

```sql
CREATE POLICY milkman_isolation ON deliveries
  USING (milkman_id = current_setting('app.current_tenant_id')::uuid);
```
A forgotten filter returns zero rows instead of leaking another tenant's data.

**Option B — enforced query layer.** Every repository method takes a `TenantContext` and injects
the filter; nothing may construct a raw query. Simpler, but one `db.raw()` escape defeats it.

**Do both if you can.** The current system has neither.

### The billing module

Isolate it. It is the only place that decides what anyone owes.

```ts
// packages/shared/src/billing.ts — pure, no I/O, exhaustively tested
export function resolveRate(plan, subscription, daysInMonth): Rate
export function computeMonthlyBill(input: BillingInput): BillingResult
```

`BillingInput` is `{ subscriptions[], deliveries[], purchases[], payments[], month }` — plain
data, no database. Then:

- Both the customer bill **and** the milkman earnings call the same functions. That single
  change eliminates BILL-2, BILL-5 and the entire 65/60/75 and 30/actual-days mess.
- Golden-file tests over real scenarios: full month, partial first month, all-skipped, mixed
  quantities, multi-plan, month boundaries, leap February.

---

## 10.5 Schema changes

Beyond [02-data-model.md](02-data-model.md):

1. **Rename to break the two-subscription confusion:**
   `platform_subscription_plans` → `saas_plans`, `milkman_subscriptions` → `saas_subscriptions`,
   `platform_payments` → `saas_payments`; `subscription_plans` → `milk_plans`,
   `subscriptions` → `milk_subscriptions`.
2. **Add `deliveries.price_per_unit`, `quantity_delivered`, `total_amount`** and **stamp
   `price_per_unit` at creation**.
3. **`UNIQUE (subscription_id, delivery_date)` on `deliveries`** — makes generation idempotent
   and structurally prevents double-billing.
4. **`UNIQUE (customer_id, month)` on `monthly_bills`.**
5. **Postgres enums** for every status, instead of text + CHECK. The CHECK constraints are
   already out of sync with the code in four places.
6. **Drop every duplicate column.**
7. **Normalise `service_areas`** into `milkman_service_areas (milkman_id, area_name, pincode)`.
8. **Add an `audit_log`** — who verified, suspended, approved, changed settings.
9. **Money as `NUMERIC(12,2)`**, never float. (Already correct — keep it.)
10. **`created_at`/`updated_at` on everything**, with a trigger for `updated_at`.

### Subscription versioning — decide this early

Today, approving a plan change **rewrites the subscription in place**, destroying history. A bill
spanning the change uses the new price for the whole month.

If you ever want mid-month proration or an accurate audit trail, version instead:

```
milk_subscriptions
  id, customer_id, milkman_id, plan_id, quantity, unit,
  delivery_time, frequency, monthly_price,
  effective_from DATE NOT NULL,
  effective_to   DATE,            -- NULL = current
  status
```
A plan change closes the current row (`effective_to = today`) and opens a new one. Billing
walks the rows overlapping the month. Slightly more work; it removes a whole class of
"why is my bill wrong" support tickets.

---

## 10.6 Scheduled jobs

Replace the in-process `setInterval` with real jobs (pg-boss):

| Job | Schedule | Does |
|---|---|---|
| `generate-deliveries` | **00:05 IST daily** | one `pending` delivery per active subscription of every approved customer, honouring `frequency`, idempotent on `(subscription_id, delivery_date)`, stamping `price_per_unit` |
| `expire-subscriptions` | hourly | expire SaaS subscriptions past `end_date` — **and nothing else** (SAAS-1) |
| `close-month` | 1st, 00:30 IST | freeze the previous month into `monthly_bills` |
| `purge-notifications` | daily | if you keep the 30-hour retention |
| `subscription-reminders` | daily | warn milkmen at 3 days / 1 day remaining |

Delivery generation must be **idempotent and backfillable** — `generate-deliveries --date=YYYY-MM-DD`
to recover from an outage.

---

<a id="realtime"></a>

## 10.7 Realtime

Replace 16 polling loops with one subscription per app:

```ts
// milkman
useRealtimeChannel(`milkman:${milkmanId}`, {
  'notification.created':        () => qc.invalidateQueries(['notifications']),
  'delivery.status_changed':     () => qc.invalidateQueries(['deliveries', date]),
  'plan_change.requested':       () => qc.invalidateQueries(['plan-change-requests']),
  'customer.registered':         () => qc.invalidateQueries(['pending-customers']),
  'subscription.status_changed': () => qc.invalidateQueries(['subscription-status']),
});
```

Supabase Realtime on Postgres changes is the least-effort path. SSE from the API gives more
control. Either way, request volume per idle user drops from ~500/hour to near zero — which is
what makes rate limiting viable again.

---

## 10.8 Frontend

- **TanStack Query for all server state.** Most of the 49 `useState` hooks in
  `CombinedDeliveriesProducts` are loading/error/data triples it handles for you.
- **Decompose the god components.** One component per tab, one hook per data source, ~300 lines
  max.
- **`packages/ui`** for `CowLoader`, `NotificationBell`, `StatCard`, `Badge`, `EmptyState`,
  layout shells, the toast config and the Tailwind preset.
- **i18n properly.** i18next with namespaces, a `no-literal-string` ESLint rule on JSX, and a CI
  check that all three locales have the same keys. That last one alone would have caught the
  Gujarati gaps.
- **Optimistic updates** on delivery status — the milkman is on a bad connection and taps fast.
- **Real offline support.** This is the one genuinely missing feature: queue delivery status
  changes in IndexedDB and sync when connectivity returns. A milkman in a basement stairwell
  currently just loses the tap.

---

## 10.9 Security checklist

- [ ] No endpoint issues a token without verifying an identity credential.
- [ ] No hardcoded secret fallbacks anywhere. Fail to boot on missing config.
- [ ] Short-lived access tokens (15 min) + rotating refresh tokens, not 7-day JWTs.
- [ ] The SaaS paywall enforced **server-side** on every milkman route.
- [ ] Tenancy enforced structurally (RLS and/or an unbypassable query layer).
- [ ] Rate limits per scope, with polling routes exempt or replaced by realtime.
- [ ] CSP without `'unsafe-inline'` for scripts.
- [ ] No dev-only auth branches. No debug routes in the codebase at all.
- [ ] Structured logging; never log full request bodies or computed financials.
- [ ] Audit log for every privileged admin action.
- [ ] Google ID tokens verified server-side with `audience` **and** `email_verified === true`.

---

## 10.10 Build order

Each phase ends with something demonstrable.

**Phase 1 — foundation (1 week)**
Monorepo, Drizzle schema + migrations, auth (Google, all three roles), tenancy, health checks,
CI. *Done when:* all three roles can sign in and see an empty shell.

**Phase 2 — SaaS layer (1 week)**
Plans, trial, UTR submission, admin verification, the paywall middleware, expiry job.
*Done when:* a milkman can trial, pay, be verified, and be locked out on expiry — **verified by
calling the API directly, not just the UI**.

**Phase 3 — customer onboarding (1 week)**
Serviceability, milkman/area pickers, registration, approval queue, customer limits, approve/reject.
*Done when:* a customer can register and be approved, and the limit blocks the N+1th.

**Phase 4 — operations (1.5 weeks)**
Milk plans, subscriptions, delivery generation job, the round view, status marking, bulk day off,
skip/resume/quantity.
*Done when:* a full day's round can be completed end to end.

**Phase 5 — billing (1 week) — do not rush this**
The pure billing module with its test suite **first**, then the customer bill screen, the
milkman earnings screen, and the month-close job.
*Done when:* customer bills and milkman earnings **reconcile exactly** on the same dataset.
That reconciliation test is the acceptance criterion.

**Phase 6 — products and payments (1 week)**
Catalog, purchases with atomic stock, offline payment submission and verification, the ledger.

**Phase 7 — requests and comms (0.5 week)**
Plan changes, quantity requests, notifications, realtime.

**Phase 8 — admin and polish (1 week)**
Analytics, audit log, customer-level support view, i18n completion, offline queueing, PWA.

**~8 weeks for one experienced full-stack developer.** The existing system took considerably
longer, and this spec removes all the discovery.

---

## 10.11 Decisions to make before writing code

These are genuine product choices the current system made implicitly, or made inconsistently.
Answer them first — each one changes the schema.

| # | Question | Current behaviour | Recommendation |
|---|---|---|---|
| 1 | Should a one-day quantity change ever alter the subscription? | yes, permanently (QTY-1) | **No.** One day means one day. |
| 2 | Multi-plan customers: bill all plans? | no, only the newest (BILL-1) | **Yes, bill all.** |
| 3 | Should `frequency` be honoured? | no — everything is daily (LOGIC-5) | **Yes, or remove the field.** |
| 4 | Version subscriptions, or rewrite in place? | rewrite, no history | **Version** if you ever want proration. |
| 5 | Is "extra milk" gross or net? | both, on different screens (LOGIC-4) | **Gross per-day** — more informative. |
| 6 | Keep 30-hour notification retention? | hard-deletes after 30 h | **Soft-delete, 90 days.** |
| 7 | Does early renewal extend or reset the period? | resets to now+30d | **Extend** from the current `end_date`. |
| 8 | Trial: 7 days / 5 customers still right? | 7 / 5, hardcoded | Make it **per-plan configuration**. |
| 9 | Should the platform ever see customer↔milkman money? | no | **Keep it that way** — it's a regulatory simplification. |
| 10 | Online payments at all? | coded, disabled | **Ship offline-only.** Add online later if asked. |
| 11 | Should admins have a customer-level view? | no — support is impossible | **Yes, read-only.** |
| 12 | Enforce the customer limit at registration too? | trials only, different count | **Yes, identically in both places.** |

---

## 10.12 Reference: local development

Current setup, for while you still run the old system alongside the new one:

```bash
npm run install:all          # root + server + 3 clients
npm run dev                  # all four concurrently
```

| Service | Port |
|---|---|
| API | 3001 (`PORT` in `server/.env`) |
| Customer | 5173 |
| Milkman | 5174 |
| Admin | 5175 |

Required `server/.env`: `PORT`, `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`JWT_SECRET`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`.
Each client: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` (must equal the server's `GOOGLE_CLIENT_ID`).

Google Cloud Console → Authorized JavaScript origins must include `http://localhost:5173`,
`:5174`, `:5175`. No redirect URIs needed — the apps use the popup/ID-token flow.

**Port conflicts:** the API defaults to 5000 but is configured for 3001 here. If another process
holds 3001, the server exits with `EADDRINUSE` while `tsx watch` stays alive — so it looks
running but isn't listening. Check with `lsof -nP -iTCP:3001 -sTCP:LISTEN` before debugging
anything else.

Deployment today: the three SPAs go to Vercel (`vercel.json` in each has the SPA rewrite and the
COOP/COEP headers Google OAuth needs). The API has no deployment config in the repo.
