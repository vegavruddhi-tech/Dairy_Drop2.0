# 9. Known Defects — Do Not Reproduce

Every item below was verified against the source on 2026-09-22. Severity is about impact on a
live business, not code aesthetics.

| Sev | Meaning |
|---|---|
| 🔴 **Critical** | money is wrong, data is exposed, or a core flow is broken |
| 🟠 **High** | a feature silently doesn't work |
| 🟡 **Medium** | inconsistency, confusing behaviour, or a scaling wall |

---

## Security

<a id="auth-3"></a>

### AUTH-3 🔴 Public endpoint mints authentication tokens

`GET|POST /api/auth/check-approval-status` is unauthenticated. Given **only an email address or
a phone number**, if the matching customer is approved it responds with a valid **7-day JWT** for
that account.

```js
if (isApproved) {
  const token = jwt.sign({ id: user.id, role: user.role || 'customer' },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-min-32-chars-long',
    { expiresIn: '7d' });
  return res.json({ isApproved: true, token, user: {...} });
}
```

Three compounding problems:
1. No authentication of any kind.
2. It falls back to a **hardcoded JWT secret** if the env var is unset — anyone who has read the
   repo can forge tokens for any account.
3. **Rate limiting was removed platform-wide** (commit `ba5f321`), so the endpoint is freely
   enumerable by phone number.

The lookup is also deliberately fuzzy (`ILIKE '%<last 10 digits>%'`), widening the match.

**Fix:** delete the token issuance. The polling screen should get `{ status }` only, and the user
signs in with Google when approved. Remove every hardcoded secret fallback — fail to boot if
`JWT_SECRET` is unset. Reinstate rate limits.

<a id="auth-2"></a>

### AUTH-2 🔴 The SaaS paywall is client-side only

`requireMilkmanSubscription` in `server/src/middleware/auth.ts:102` is fully written, exported,
and **mounted on zero routes**. The only enforcement is in the milkman app's `ProtectedRoute`.

A milkman whose trial expired keeps full API access — customers, deliveries, plans, earnings —
by calling the API directly or by pinning an older client bundle. The product's entire
monetisation is bypassable.

**Fix:** mount it on `/api/milkman` (and the milkman-scoped routes in `/api/zones`,
`/api/payments`). Keep the client check as UX, not as the control.

<a id="auth-4"></a>

### AUTH-4 🟠 Dev backdoor accepts unverified identity

`POST /auth/google`:

```js
if (credential) { /* verify with Google */ }
else if (process.env.NODE_ENV === 'production') {
  return res.status(400).json({ message: 'Google credential is required' });
}
// otherwise: fall through and trust req.body.email / req.body.name
```

When `NODE_ENV !== 'production'`, anyone can log in as any existing customer by posting
`{ email: "victim@example.com", name: "x" }`. Safe in production *only* because `NODE_ENV` is
set correctly — a single misconfigured deploy makes it a full authentication bypass.

Two dev-only debug routes have the same guard: `GET /auth/debug-db-3` (inserts a fake payment
row) and `GET /admin/debug-db`.

**Fix:** always require and verify the credential. Delete the debug routes.

<a id="sec-1"></a>

### SEC-1 🟠 No rate limiting anywhere

`express-rate-limit` is a dependency; all middleware was removed after it caused 429s in
production — because a single global limiter was counting the 8–10 second notification polls.

**Fix:** per-scope limits (strict on auth, generous on authenticated reads, exempt or
much higher for polling), or remove polling entirely.

<a id="sec-2"></a>

### SEC-2 🟡 No RLS; tenancy is hand-written everywhere

The backend uses the Supabase **service-role key**, which bypasses row-level security, and the
schema defines **zero policies**. Isolation between milkmen depends on ~150 hand-written
`.eq('milkman_id', …)` clauses. One omission is a cross-tenant leak with no second line of
defence.

**Fix:** enforce tenancy in one place — RLS with a request-scoped claim, or a query layer that
cannot be bypassed. See [10-rebuild-guide.md](10-rebuild-guide.md#tenancy).

<a id="sec-3"></a>

### SEC-3 🟡 CSP allows `'unsafe-inline'` scripts

`script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com` defeats
most of CSP's XSS value. **Fix:** nonces or hashes.

---

## Money

<a id="bill-1"></a>

### BILL-1 🔴 Only one subscription is ever billed

`GET /customer/deliveries/billing-breakdown` resolves the subscription with `.limit(1)`
ordered by `created_at DESC`. A customer with two plans (1 L morning + 0.5 L evening) is billed
using only the most recent one's rate. The product supports multi-plan everywhere else —
signup, the dashboard, the round view, the customer list.

**Direct revenue loss on every multi-plan customer.**

**Fix:** compute per subscription and sum. Delivery rows already carry `subscription_id`.

<a id="bill-4"></a>

### BILL-4 🔴 Payments are summed across all time against a single month's bill

```js
verifiedPayments = payments WHERE customer_id = me AND status IN (...)   // no date filter
totalPaidAmount  = Σ verifiedPayments.amount
balanceDue       = max(0, totalBillAmount - totalPaidAmount)
```

`totalBillAmount` is **one month**; `totalPaidAmount` is **every payment ever made**. After
month two, every month reports `paid` with a large `advanceCredit`, and `balanceDue` is 0 for
customers who owe money.

**Fix:** scope payments to the month — join through `bill_id`, or filter by month — and make
`monthly_bills` the ledger of record.

<a id="bill-5"></a>

### BILL-5 🔴 Delivery amounts are computed at a hardcoded ₹75/L

`POST /milkman/deliveries/update-status`:
```js
const pricePerUnit = Number(delivery.price_per_unit || 75);
updateData.total_amount = round2(targetQty * pricePerUnit);
```

`deliveries.price_per_unit` is **never written by any code path**, so it is always NULL and
`total_amount` is always `qty × 75` regardless of the customer's actual plan.

The customer's bill ignores `total_amount` and recomputes from the plan, so customers are billed
correctly — but **the milkman's earnings screen reads `total_amount`**, so the milkman's revenue
figure is fiction.

**Fix:** stamp `price_per_unit` onto the delivery row when it is created, from the subscription's
resolved rate. A delivery is an immutable financial record and must carry its own price.

<a id="bill-2"></a>

### BILL-2 🟠 Two different day-counts and three different fallback rates

| Calculation | Days per month | ₹/L fallback |
|---|---|---|
| Customer bill | **actual (28–31)** | **65** |
| Milkman stats | **30 hardcoded** | **60** |
| Milkman earnings | **30 hardcoded** | **60** |
| Delivery `total_amount` | — | **75** |

The milkman's revenue can never equal the sum of their customers' bills.

**Fix:** one rate resolver and one calendar function, shared by both sides.

<a id="bill-3"></a>

### BILL-3 🟠 Last-day product purchases are dropped; cancelled ones are billed

```js
product_purchases WHERE created_at >= '2026-09-01' AND created_at <= '2026-09-30'
```

`created_at` is `TIMESTAMPTZ`; the bare date coerces to midnight, so **everything bought on the
last day of the month is excluded**. There is also no `status` filter, so **cancelled purchases
are billed**.

Billing filters on `created_at` while every listing and the earnings calculation filter on
`purchase_date` — they can diverge.

**Fix:** half-open interval `[monthStart, nextMonthStart)` on `purchase_date`, and exclude
`status = 'cancelled'`.

<a id="pay-1"></a>

### PAY-1 🟠 Payment verification is not idempotent

`monthly_bills.paid_amount` is incremented by the payment amount with no guard on the payment's
prior status. Verifying the same payment twice — a double-click, a retry — double-counts it and
can mark an unpaid bill as paid.

**Fix:** only transition from `initiated`, and/or recompute `paid_amount` as a sum over verified
payments rather than incrementing.

<a id="prod-1"></a>

### PROD-1 🟠 Stock decrement has a race; cancellation never restores stock

```js
newStock = max(0, product.available_quantity - requestedQty);
UPDATE daily_products SET available_quantity = newStock, ...
```

Read-then-write with no transaction, no row lock, no constraint. Two concurrent orders for the
last unit both succeed. Separately, cancelling a purchase never adds stock back.

**Fix:**
```sql
UPDATE daily_products SET available_quantity = available_quantity - $qty
 WHERE id = $id AND available_quantity >= $qty RETURNING *;   -- 0 rows ⇒ insufficient
```
plus `CHECK (available_quantity >= 0)`, and a compensating update on cancellation.

<a id="bill-6"></a>

### BILL-6 🟡 "No delivery rows" bills a full month

If a month has no delivery rows at all, the bill falls back to the full `baseMonthlyPrice`.
That is a reasonable safety net for a customer whose rows were never generated — but since
generation is manual (DELIV-1), it can also fire when generation is merely late, billing a full
month on top of whatever is delivered afterwards.

---

## Broken features

<a id="auth-1"></a>

### AUTH-1 🔴 Customer Google login sends the wrong field name

`client-customer/src/pages/Auth/CustomerLogin.tsx:38` sends `token:`; the server reads
`credential:`.

```js
// client
api.post('/auth/google', { token: credentialResponse.credential, email, name, picture })
// server
const { credential, email: rawEmail, ... } = req.body;
```

- **Development:** `credential` is undefined, so the handler falls through to the AUTH-4 branch
  and trusts the body's email. It *appears* to work while performing **no token verification**.
- **Production:** returns `400 "Google credential is required"`. **Login is dead.**

Every other login page sends `credential` correctly. `CustomerLogin.tsx` is the only wrong one,
and it is the one wired to `/login`.

<a id="saas-1"></a>

### SAAS-1 🔴 Paid subscriptions force-expire after 7 days

`syncExpiredSubscriptions`, which runs every 5 minutes:

```js
if (!sub.payment_ref && daysSinceCreated >= 7) expiredIds.push(sub.id);
```

`payment_ref` is only set by the UTR submission path. A subscription activated any other way —
by `POST /milkman/subscription/initiate`, by an admin, or seeded — has no `payment_ref` and is
**force-expired 7 days after creation regardless of its `end_date`**. Paying milkmen lose access
on day 8.

**Fix:** expire only when `end_date < now`. Trials get an `end_date` at creation, so no special
case is needed.

<a id="schema-drift"></a>
<a id="schema-1"></a>

### SCHEMA-1 🔴 Three delivery columns are missing from the schema file

`deliveries.quantity_delivered`, `total_amount` and `price_per_unit` are written and read
throughout the code (9, 39 and 23 references) but are **absent from
`FULL_DATABASE_SCHEMA.sql`**.

Against a database built purely from that file, PostgREST rejects the update and **no delivery
can ever be marked delivered**. The live database must have had them added by hand — meaning
the committed schema cannot reproduce a working system.

<a id="deliv-1"></a>

### DELIV-1 🟠 Nothing generates daily deliveries

`POST /milkman/admin/generate-daily-deliveries` exists but **no scheduler, cron or timer calls
it**. The only automatic job in the process is the 5-minute subscription-expiry sync.

Rows appear only via the lazy paths (approval, subscribe, status update, bulk day off) or are
synthesised on the fly by the round view. Days with no interaction leave no record — which, via
BILL-6, can bill a full month.

The endpoint also has two internal bugs: the existence check `.maybeSingle()` on
`(customer_id, today)` omits `subscription_id` (throws for multi-plan customers), and
`frequency` is ignored so `alternate_days`/`weekly`/`monthly` plans generate a delivery **every
day**.

<a id="qty-1"></a>

### QTY-1 🟠 A one-day quantity change permanently rewrites the subscription

Accepting a quantity change request:

```js
UPDATE deliveries SET quantity = requested_quantity
  WHERE customer_id = ... AND delivery_date = ...      // no subscription_id filter

if (no other pending requests) {
  UPDATE subscriptions SET quantity = requested_quantity
    WHERE customer_id = ... AND is_active = true       // permanent, and ALL subscriptions
}
```

A customer asking for 2 L *tomorrow only* has their standard daily quantity permanently changed
to 2 L, on **every** plan they hold. Neither party asked for that, and the UI doesn't warn.

**Fix:** a one-day change touches exactly one delivery row. Permanent changes are plan changes.

<a id="push-1"></a>

### PUSH-1 🟠 Web push is entirely non-functional

Three independent blockers: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are unset, the
`push_subscriptions` table doesn't exist, and the client calls
`POST /push-notifications/unsubscribe` which isn't implemented.

Either finish it or remove it — the current state is ~350 lines of code that silently does nothing.

<a id="pay-2"></a>

### PAY-2 🟠 Razorpay is wired but disabled

`create-order` and `verify-payment` implement a correct order + HMAC-SHA256 flow, but the keys
are unset so `razorpayInstance` is `null` and both fail closed. All real money moves through
the offline UTR path.

<a id="schema-2"></a>

### SCHEMA-2 🟠 Four tables are queried but never defined

| Table | Where | Impact |
|---|---|---|
| `products` | `customer.routes.ts` ×3 | **breaks `POST /customer/subscribe-plan`** |
| `platform_plans` | `admin.routes.ts:243` | plan distribution always reads "7-Day Free Trial" |
| `customers` | `auth.routes.ts` ×4 | legacy; selects silently return null |
| `push_subscriptions` | push service ×5 | push is dead |

Correct names: `daily_products`, `platform_subscription_plans`, (none — use `users`), and
`push_subscriptions` genuinely needs creating.

<a id="schema-3"></a>

### SCHEMA-3 🟠 `status` CHECK constraints reject values the code writes

| Table | Value written | In CHECK? |
|---|---|---|
| `milkman_subscriptions` | `pending_payment` | **no** → `POST /milkman/subscription/initiate` always fails |
| `milkman_subscriptions.payment_status` | `rejected` | **no** → admin rejection fails |
| `subscriptions` | `rejected` | **no** → customer rejection's subscription update fails |
| `payments` | `completed` | **no** — but it's read as "paid" in 5 places |

<a id="build-1"></a>

### BUILD-1 🟠 `vite.config.js` shadows `vite.config.ts` in two apps

`client-customer` and `client-milkman` each ship **both**. Vite resolves `.js` first, so the
`.ts` configs — carrying manual chunk splitting, `optimizeDeps`, path aliases and the real PWA
icon set — are **dead code**. `client-admin` has only `.ts`, so the three apps build differently
from configs that look identical at a glance.

**Fix:** delete the `.js` files.

<a id="fe-1"></a>

### FE-1 🟡 17 frontend calls hit endpoints that don't exist

All but one are in dead pages. The exception is
`POST /push-notifications/unsubscribe`, which is on a live path. Full list in
[05-api-reference.md](05-api-reference.md#511-frontend-calls-with-no-backend-route).

---

## Correctness and consistency

<a id="date-1"></a>

### DATE-1 🟠 UTC and IST are mixed

`utils/date.ts` provides correct IST-anchored helpers, but **~40 call sites still use
`new Date().toISOString().split('T')[0]`**, which is UTC. The customer side (skip, resume,
quantity change, subscription writes) is UTC; the milkman side is IST.

**Between 00:00 and 05:30 IST the two disagree about what day it is** — and the round starts at
05:00. A customer skipping "today" at 1 a.m. skips yesterday.

<a id="data-1"></a>

### DATA-1 🟡 `monthly_bills` has no unique constraint but is read with `.maybeSingle()`

`.maybeSingle()` **throws** when more than one row matches. Nothing prevents two rows for the
same `(customer_id, month)`. **Fix:** `UNIQUE (customer_id, month)`.

<a id="logic-1"></a>

### LOGIC-1 🟡 Two divergent implementations of plan-change approval

`PATCH /milkman/plan-change-requests/:id/approve` (TypeScript, five validations) and
`PUT /milkman/plan-change-requests/:id` (the `resolve_plan_change_request` Postgres RPC, no
validations). Same business rule, two implementations, different behaviour. Delete one.

<a id="logic-2"></a>

### LOGIC-2 🟡 Customer-limit checks differ between registration and approval

| | Registration | Approval |
|---|---|---|
| Counts | **all** customers | only `is_approved = true` |
| Applies to | **trials only** | trials and paid plans |

So a milkman with 5 pending signups can't receive a 6th despite having 0 approved; and a paid
milkman at their ceiling accepts unlimited registrations, failing only at approval time.

<a id="logic-3"></a>

### LOGIC-3 🟡 `is_active` and `status` duplicate each other

`subscriptions` carries both. Every transition writes both; every read is
`is_active === true || status === 'active'`. Constant drift risk. Keep `status` only.

<a id="logic-4"></a>

### LOGIC-4 🟡 Two contradictory definitions of "extra milk"

- **Invoice:** net monthly — `max(0, totalDelivered − deliveredDays × standardQty)`.
- **History:** gross per-day — `Σ (quantity − standardQuantity)` over days where positive.

+0.5 L on the 3rd and −0.5 L on the 9th give **0** on the invoice and **0.5** in history. Both
screens are visible to the same customer.

<a id="logic-5"></a>

### LOGIC-5 🟡 `frequency` is stored but never honoured

`daily | alternate_days | weekly | monthly` is captured on plans and subscriptions, shown in the
UI, and **completely ignored** by delivery generation. Every plan delivers daily.

<a id="data-2"></a>

### DATA-2 🟡 Duplicate columns throughout

| Table | Duplicates |
|---|---|
| `users` | `milkman_id` / `assigned_milkman_id` |
| `addresses` | `street`/`address_line1`, `landmark`/`address_line2`, `pincode`/`postal_code`, `is_default`/`is_primary` |
| `deliveries` | `notes` / `delivery_notes` / `reason` |
| `platform_payments` | `transaction_id` / `utr_number` |
| `subscriptions` | `is_active` / `status` |

Writes populate both halves; reads use `a || b` fallbacks everywhere.

<a id="data-3"></a>

### DATA-3 🟡 Dead tables

`daily_product_orders` and `additional_orders` are read but never written. `milkman_products` is
never touched at all. `milkman_notifications` is only ever purged. `delivery_routes` is nearly
vestigial.

<a id="api-1"></a>

### API-1 🟡 Fields overloaded for unrelated data

Offline payments store `'UTR-<utr>'` in `razorpay_payment_id` and the customer's note in
`failure_reason`. **Fix:** first-class `reference` and `customer_note` columns.

<a id="api-2"></a>

### API-2 🟡 The API returns Tailwind classes

`GET /admin/stats` returns `badgeColor: "bg-emerald-100 text-emerald-800"`. Presentation must
not come from the API.

---

## Scale and maintainability

<a id="perf-1"></a>

### PERF-1 🟠 Unbounded queries with in-memory aggregation

~110 `select('*')` calls against ~40 with `.limit()`/`.range()`. `GET /milkman/earnings` fetches
**every** delivery, payment and purchase the milkman has ever had and sums them in Node — about
73,000 rows for 100 customers after two years, on every page load.

**Fix:** aggregate in SQL with date bounds.

<a id="perf-2"></a>

### PERF-2 🟠 Aggressive polling

16 `setInterval` loops across the three apps: notifications every 8–10 s, subscription status
every 60 s, request counts every 30 s, dashboards every 30 s, plus a 5-minute session re-verify.
Every authenticated request re-reads the user row from the database.

A milkman idling on the dashboard generates **~500 requests/hour**. This is what forced rate
limiting to be removed.

**Fix:** one realtime channel, or SSE. See [10-rebuild-guide.md](10-rebuild-guide.md#realtime).

<a id="perf-3"></a>

### PERF-3 🟡 Verbose production logging

199 `console.log` calls in server routes, including full request payloads and computed billing
figures. `milkman.routes.ts` alone has 69. **Fix:** a structured logger with levels.

<a id="maint-1"></a>

### MAINT-1 🟠 27 of 58 page files are unreachable

6 in customer, 21 in milkman, 0 in admin — roughly **8,000 lines of dead page code**. Full list
in [06](06-frontend-customer.md#611-dead-pages) and [07](07-frontend-milkman.md#714-dead-pages-21-of-34).

<a id="maint-2"></a>

### MAINT-2 🟠 God components and god route files

| File | Size |
|---|---|
| `CombinedDeliveriesProducts.tsx` | **3,626 lines, 49 `useState` hooks** |
| `milkman.routes.ts` | **4,267 lines** |
| `customer.routes.ts` | 2,734 lines |
| `Dashboard.tsx` (customer) | 1,703 lines |
| `auth.routes.ts` | 1,290 lines |

<a id="maint-3"></a>

### MAINT-3 🟠 Triplicated, diverged shared code

`api.ts`, `authStore.ts`, `CowLoader`, `NotificationBell`, `PWAInstallBanner`, `MainLayout`,
`Header`, `Sidebar` exist in all three apps as **copies that have since diverged** — verified,
every one has a different file hash. No shared package.

<a id="maint-4"></a>

### MAINT-4 🟠 The i18n layer is mostly bypassed

~337 `t()` calls against **1,033 inline `language === 'hi' ? … : …` ternaries**. Most strings
never reach the catalog, and Gujarati is frequently missing from those ternaries (they test only
for `hi`, so Gujarati speakers silently get English). The admin app has no i18n at all.

<a id="maint-5"></a>

### MAINT-5 🟡 Endpoint aliases maintained for client drift

11 groups of duplicate routes — three URLs for the active plans list, three verbs for the
milkman profile update, and so on. Full list in
[05-api-reference.md](05-api-reference.md#512-endpoint-aliases-to-drop).

<a id="maint-6"></a>

### MAINT-6 🟡 No tests, no CI, no containerisation

Zero test files, no `.github/`, no Dockerfile, no `CLAUDE.md`. The npm-script monorepo has four
separate lockfiles and no workspace linking.

<a id="maint-7"></a>

### MAINT-7 🟡 Dead dependencies and template leftovers

`mongoose` and four Mongoose models (`User`, `Product`, `Subscription`, `Delivery`) remain from
a pre-Supabase era, reachable only from an unused seed script. `src/App.jsx` and `src/main.jsx`
Vite template files sit beside the real `.tsx` entry points in two apps, and the stock
`README.md` ships in all three.

---

## Fix-first list

If you were patching the existing system rather than rebuilding, in this order:

| # | Defect | Effort |
|---|---|---|
| 1 | AUTH-3 — remove the public token-minting endpoint | 30 min |
| 2 | AUTH-2 — mount `requireMilkmanSubscription` | 15 min |
| 3 | AUTH-1 — `token:` → `credential:` | 1 min |
| 4 | SAAS-1 — drop the `!payment_ref` expiry rule | 5 min |
| 5 | SCHEMA-1 — add the three `deliveries` columns | 15 min |
| 6 | BILL-4 — scope payments to the month | 2 h |
| 7 | BILL-1 — bill all subscriptions | 3 h |
| 8 | BILL-5 — stamp `price_per_unit` at delivery creation | 2 h |
| 9 | AUTH-4 — remove the dev backdoor and debug routes | 30 min |
| 10 | DELIV-1 — schedule delivery generation | 3 h |

Items 1–5 and 9 are roughly two hours total and close every critical security and access hole.
