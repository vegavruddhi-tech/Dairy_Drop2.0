# 4. Business Logic — All Calculations and Rules

Every formula below is extracted verbatim from the running implementation. Where the
implementation is wrong or inconsistent, the **correct** rule is stated and the discrepancy is
flagged.

Notation: `round2(x) = Math.round(x * 100) / 100`.

---

## 4.1 Dates and the business day

All date logic is anchored to **Asia/Kolkata**, not UTC. This matters because between 00:00 and
05:30 IST, `new Date().toISOString().slice(0,10)` yields *yesterday* — and the milkman's round
starts at 05:00.

```js
businessDate(d = now, tz = 'Asia/Kolkata')  // → 'YYYY-MM-DD'
  = Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
      .format(d)

businessMonth(d, tz) = businessDate(d, tz).slice(0, 7)   // 'YYYY-MM'
```

`en-CA` is used because it formats as `YYYY-MM-DD` natively.

> ⚠️ The helper exists and is correct, but **~40 call sites still use
> `new Date().toISOString().split('T')[0]` directly**, which is UTC. Customer-side skip/resume/
> quantity-change and several subscription writes are all UTC-based, while the milkman side is
> IST-based. Between midnight and 05:30 IST they disagree about what day it is.
> **On rebuild: one date helper, used everywhere, no exceptions.**

**Days in a month** is always the true calendar count:
```js
daysInMonth(year, month) = new Date(year, month, 0).getDate()   // 28 | 29 | 30 | 31
```

---

## 4.2 Customer monthly bill

`GET /api/customer/deliveries/billing-breakdown?month=YYYY-MM`

The single most important calculation in the product. It is computed **live on every request** —
there is no month-end billing job and no stored bill.

### Step 1 — guard

If the customer is not approved, return `{ isPending: true }` with a zeroed summary. No bill
exists before approval.

### Step 2 — resolve the subscription

```js
subscription = first row of
  subscriptions WHERE customer_id = me AND (is_active = true OR status = 'active')
  ORDER BY created_at DESC
  LIMIT 1
```

> ⚠️ **`LIMIT 1` — only one subscription is ever billed.** A customer holding two plans
> (e.g. 1L morning + 0.5L evening) is billed for whichever was created most recently. The
> product supports multi-plan everywhere else. **On rebuild, bill per subscription and sum.**
> See [09-known-defects.md](09-known-defects.md#bill-1).

If no subscription → 404.

### Step 3 — window

```js
daysInMonth  = daysInMonth(year, month)
startOfMonth = (subscription started in this month) ? subscription.start_date : `${month}-01`
endOfMonth   = `${month}-${daysInMonth}`
```

Starting the window at `start_date` is what makes the first month pro-rata: a customer who joins
on the 20th only has delivery rows from the 20th, so only those are billed.

### Step 4 — classify deliveries

```js
monthDeliveries    = deliveries WHERE customer_id = me
                       AND delivery_date BETWEEN startOfMonth AND endOfMonth
deliveredRecords   = monthDeliveries WHERE status = 'delivered'
skippedRecords     = monthDeliveries WHERE status = 'skipped'
undeliveredRecords = monthDeliveries WHERE status = 'undelivered'

deliveredDays      = count(deliveredRecords)
totalDeliveredSum  = Σ deliveredRecords.quantity        // actual litres delivered
standardDailyQty   = subscription.quantity ?? 1
```

### Step 5 — resolve the rate

A four-level fallback chain:

```js
baseMonthlyPrice   = subscription.monthly_price ?? 0
planPricePerDelivery = 0

if (subscription.plan_id) {
  plan = subscription_plans[subscription.plan_id]
  if (plan.monthly_price && !baseMonthlyPrice) baseMonthlyPrice = plan.monthly_price
  if (plan.price_per_delivery)                 planPricePerDelivery = plan.price_per_delivery
}

if (!baseMonthlyPrice && subscription.milkman_id) {
  // find any active plan from this milkman with the same daily quantity
  milkmanPlan = subscription_plans WHERE milkman_id = … AND quantity = standardDailyQty
                                     AND is_active = true
  baseMonthlyPrice     = milkmanPlan?.monthly_price ?? standardDailyQty * 65 * daysInMonth
  planPricePerDelivery = milkmanPlan?.price_per_delivery ?? planPricePerDelivery
}
```

`65` is a hardcoded ₹/litre/day fallback. It appears nowhere else — other fallbacks use 60 or 75.

### Step 6 — daily rate and unit price

```js
dailyRate = planPricePerDelivery > 0
              ? planPricePerDelivery                                   // explicit per-delivery price wins
              : (baseMonthlyPrice > 0 ? baseMonthlyPrice / daysInMonth // else derive from monthly
                                      : 65 * standardDailyQty)         // else fallback

pricePerUnit = dailyRate / max(1, standardDailyQty)                    // ₹ per litre
```

Dividing by the **true** days in the month means a ₹1800/month plan is ₹60.00/day in September
(30 days) and ₹58.06/day in October (31 days). The customer pays the same monthly total for a
full month either way. This is the intended behaviour.

> ⚠️ **Inconsistent elsewhere.** `GET /milkman/stats` and `GET /milkman/earnings` both divide
> by a hardcoded `30` instead of `daysInMonth`. The milkman's revenue figure therefore disagrees
> with the sum of their customers' bills in every month that isn't 30 days long.
> **On rebuild, one rate function used by both sides.** See [09-known-defects.md](09-known-defects.md#bill-2).

### Step 7 — milk total

```js
deliveriesTotal = monthDeliveries.length > 0
                    ? totalDeliveredSum * pricePerUnit      // usage-based
                    : (baseMonthlyPrice || dailyRate * daysInMonth)  // no rows yet → full month
```

**The customer is billed for litres actually delivered, not days subscribed.** Skipped and
undelivered days cost nothing. A day where 1.5L was delivered against a 1L plan costs 1.5×
the unit price.

The `else` branch (no delivery rows at all) bills a full month — a safety net for a customer
whose delivery rows were never generated. It is also a **double-billing hazard** if delivery
generation is merely late.

### Step 8 — extra products

```js
productPurchases = product_purchases WHERE customer_id = me
                     AND created_at BETWEEN startOfMonth AND endOfMonth
additionalOrdersTotal = Σ productPurchases.total_amount
```

> ⚠️ Two bugs here.
> 1. Filtering a `TIMESTAMPTZ` against the bare date string `'YYYY-DD-31'` means
>    `<= 2026-10-31T00:00:00Z` — **every purchase made on the last day of the month is excluded.**
> 2. `status` is not filtered, so **cancelled purchases are billed.**
>
> Correct: filter on `purchase_date`, use a half-open interval `[start, nextMonthStart)`, and
> exclude `status = 'cancelled'`. See [09-known-defects.md](09-known-defects.md#bill-3).

### Step 9 — totals

```js
subscriptionAmount = round2(deliveriesTotal)
totalBillAmount    = max(0, round2(deliveriesTotal + additionalOrdersTotal))
```

### Step 10 — payments applied

```js
verifiedPayments = payments WHERE customer_id = me
                     AND status IN ('completed','success','captured')
totalPaidAmount  = Σ verifiedPayments.amount
balanceDue       = max(0, round2(totalBillAmount - totalPaidAmount))
advanceCredit    = max(0, round2(totalPaidAmount - totalBillAmount))
```

> ⚠️ **Payments are summed across all time, but the bill is for one month.** A customer who has
> paid 6 months of bills shows `totalPaidAmount` = 6 months against a 1-month
> `totalBillAmount`, so every month after the first reads "paid" with a large `advanceCredit`.
> **The ledger must be scoped to the month** (join on `bill_id`, or filter payments by month).
> See [09-known-defects.md](09-known-defects.md#bill-4).

### Step 11 — payment status

In priority order:

```js
if (totalPaid >= totalBill && totalBill > 0)      status = 'paid'
else if (totalPaid > 0 && totalPaid < totalBill)  status = 'partially_paid'
else if (a pending payment exists)                status = 'pending_verification'
else                                              status = 'unpaid'
```

A `monthly_bills` row for the month, if present, seeds the initial status before these overrides.

### Step 12 — extra/reduced milk split (presentation only)

```js
standardDeliveredLitres = deliveredDays * standardDailyQty       // what the plan implies
extraMilkLitres     = max(0, round2(totalDeliveredSum - standardDeliveredLitres))
reducedMilkLitres   = max(0, round2(standardDeliveredLitres - totalDeliveredSum))
regularDeliveredLitres = min(totalDeliveredSum, standardDeliveredLitres)

extraMilkAmount   = round2(extraMilkLitres * pricePerUnit)
regularMilkAmount = round2(regularDeliveredLitres * pricePerUnit)
```

This is a **net** figure across the month: +0.5L on the 3rd and −0.5L on the 9th cancel to zero
extra. The customer's *history* screen computes a **gross** figure instead (per-day
`quantity − standardQuantity`, summed only over days where it's positive), so the two screens
legitimately disagree. Pick one definition.

Note `regularMilkAmount + extraMilkAmount === subscriptionAmount` always holds, so this is a
pure decomposition for display — it doesn't affect the total.

### Worked example

Plan: 1 L/day, ₹1800/month, no `price_per_delivery`. Month: September (30 days).
Delivered 26 days: 24 at 1 L, 1 at 1.5 L, 1 at 0.5 L. Skipped 4 days. One ₹250 ghee purchase.

```
daysInMonth             = 30
baseMonthlyPrice        = 1800
dailyRate               = 1800 / 30            = 60.00
standardDailyQty        = 1
pricePerUnit            = 60.00 / 1            = 60.00

deliveredDays           = 26
totalDeliveredSum       = 24(1) + 1.5 + 0.5    = 26.0 L
deliveriesTotal         = 26.0 × 60.00         = 1560.00
subscriptionAmount                              = 1560.00
additionalOrdersTotal                           =  250.00
totalBillAmount                                 = 1810.00

standardDeliveredLitres = 26 × 1               = 26.0 L
extraMilkLitres         = max(0, 26.0 − 26.0)  =  0.0 L      ← the +0.5 and −0.5 net out
regularDeliveredLitres  = min(26.0, 26.0)      = 26.0 L
regularMilkAmount                               = 1560.00
```

The 4 skipped days saved the customer ₹240 off the ₹1800 list price.

---

## 4.3 Delivery status and per-delivery amount

`POST /api/milkman/deliveries/update-status`

```js
pricePerUnit = delivery.price_per_unit ?? 75         // ⚠️ hardcoded fallback, differs from 60/65 used elsewhere
targetQty    = (quantity given) ? Number(quantity) : delivery.quantity ?? 1
```

| New status | `quantity_delivered` | `total_amount` | `delivered_at` |
|---|---|---|---|
| `delivered` | `targetQty` | `round2(targetQty × pricePerUnit)` | `now()` |
| `undelivered` | `0` | `0` | `NULL` |
| `skipped` | `0` | `0` | `NULL` |
| `pending` | `NULL` | `0` | `NULL` |

`reason` is stored on `delivery_notes`.

> ⚠️ `deliveries.price_per_unit` is **never written by any code path**, so it is always NULL and
> `total_amount` is always `qty × 75` regardless of the customer's actual plan price. The
> customer's bill ignores `total_amount` and recomputes from the plan, so the customer is billed
> correctly — but the **milkman's earnings screen reads `total_amount`**, so the two sides
> disagree. See [09-known-defects.md](09-known-defects.md#bill-5).
>
> **Fix:** stamp `price_per_unit` onto the delivery row at creation time, from the subscription's
> resolved rate. A delivery is an immutable financial record; it should carry its own price.

### Lazy creation

If no delivery row exists for `(customer, date)`, the endpoint creates one from the customer's
active subscription first — after asserting the customer belongs to this milkman **and** is
approved. Then it applies the status. This makes the round view work even when the nightly
generation job hasn't run.

### Bulk day off

`POST /api/milkman/deliveries/bulk-day-off { date, reason }`

- If delivery rows exist for that date → set them all to `skipped`, `total_amount = 0`,
  `quantity_delivered = 0`, `delivered_at = NULL`, `delivery_notes = reason ?? 'Milkman Day Off'`.
- If none exist → create one `skipped` row per active subscription of every approved customer.

Affects **every** customer of that milkman for that date. There is no confirmation step on the
API side; the UI must confirm.

---

## 4.4 Delivery generation

`POST /api/milkman/admin/generate-daily-deliveries`

```
for each subscription WHERE is_active = true
  and customer is_approved = true:
    if no delivery exists for (customer_id, today): create
      { customer_id, milkman_id, subscription_id, product_id, product_name,
        quantity: subscription.quantity, delivery_date: today,
        delivery_time: subscription.delivery_time, status: 'pending' }
```

> ⚠️ **Three problems.**
> 1. **Nothing calls this.** There is no cron, no scheduler, no timer. The only automatic job in
>    the process is the 5-minute subscription-expiry sync. Delivery rows in practice appear via
>    the lazy paths (approval, subscribe, status update, bulk day off, or the virtual round view).
> 2. The existence check uses `.maybeSingle()` on `(customer_id, today)` with **no
>    `subscription_id`** — so for a multi-plan customer it throws once a second row exists, and
>    it would block the second plan's delivery anyway.
> 3. `frequency` is ignored — `alternate_days`, `weekly` and `monthly` plans all generate a
>    delivery **every day**.
>
> **On rebuild:** a real scheduled job at 00:05 IST, keyed on `(subscription_id, delivery_date)`
> with a unique index for idempotency, and honouring `frequency`.

### Where delivery rows are created today

| Trigger | Creates |
|---|---|
| Milkman approves a customer | today's row for the activated subscription |
| Customer acquires a plan (`POST /customer/subscriptions`) | today's row, if `start_date <= today` |
| Milkman marks a status and no row exists | that date's row |
| Bulk day off with no rows | a `skipped` row per active subscription |
| Customer skips/resumes/changes quantity for a date | that date's row |

### The virtual round view

`GET /api/milkman/deliveries/date?date=YYYY-MM-DD` does **not** require rows to exist. It builds
the round from active subscriptions and left-joins whatever delivery rows do exist:

```js
subscriptions = active subs for this milkman
customers     = approved customers among them          // unapproved are excluded
existing      = deliveries for (milkman, date), keyed by subscription_id

for each subscription of an approved customer:
    row = existing[subscription.id]
    currentQty = row?.quantity ?? subscription.quantity ?? 1
    currentQty = approvedQuantityChange[customer_id] ?? currentQty   // accepted requests win
    status     = row?.status ?? 'pending'
    id         = row?.id ?? `temp-${subscription.id}-${date}`        // synthetic id
```

Rows with a `temp-` id have never been persisted. The UI must treat them as pending and let the
milkman act on them (which triggers lazy creation).

---

## 4.5 SaaS subscription lifecycle

### Free trial

`POST /api/milkman/subscription/free-trial`

Preconditions: no `active` or `trial` subscription exists, **and** no row with `plan_id IS NULL`
has ever existed for this milkman (that is the "already used your trial" test).

```js
{ milkman_id, plan_id: NULL, status: 'trial',
  start_date: now, end_date: now + 7 days,
  auto_renew: false, payment_status: 'paid', trial_customer_limit: 5 }
```

**Trial = 7 days, 5 customers.** `plan_id IS NULL` is the canonical marker of a trial.

### Paid subscription

`POST /api/milkman/subscription/submit-payment { planId, transactionRef }`

The milkman pays offline to the platform's UPI/QR (from `platform_settings`) and submits the UTR.

```js
{ plan_id, status: 'pending', payment_status: 'pending',
  payment_ref: transactionRef.trim(),
  start_date: now, end_date: now + 30 days, auto_renew: false }
```

Updates the milkman's existing subscription row if one exists (rejecting if already `active`),
otherwise inserts. All admins are notified.

### Admin verification

`POST /api/admin/subscriptions/:id/verify { action, rejectReason }`

**approve:**
```js
milkman_subscriptions: status='active', payment_status='paid',
                       start_date=now, end_date=now + 30 days
platform_payments    : INSERT { amount: plan.monthly_price, payment_method:'upi',
                                transaction_id: payment_ref, status:'success', paid_at: now }
notify milkman
```
Note `end_date` is **reset to now + 30 days**, discarding whatever the milkman submitted. A
milkman who pays early loses the remaining days. Decide whether to extend from the current
`end_date` instead.

**reject:**
```js
milkman_subscriptions: status='cancelled', payment_status='rejected', notes=rejectReason
platform_payments    : INSERT { …, status:'failed' }
notify milkman
```

**Billing period is a fixed 30 days from activation**, not a calendar month. Nothing renews
automatically — `auto_renew` is stored and never acted on.

### Expiry sync

Runs at boot and **every 5 minutes** in-process.

```js
for each subscription WHERE status IN ('trial','active'):
    daysSinceCreated = (now - (created_at ?? start_date)) / 1 day
    endDate = end_date
            ?? (start_date ?? created_at) + (status==='trial' || !plan_id ? 7 days : 1 month)

    if (!payment_ref && daysSinceCreated >= 7)          → expire     // ⚠️ see below
    else if (endDate && endDate < now)                  → expire
    else if (status === 'trial' && daysSinceCreated>=7) → expire

expire: UPDATE status='expired'
```

> ⚠️ **Rule 1 is a live bug.** `payment_ref` is only set by the UTR submission path. A
> subscription activated any other way — by `POST /milkman/subscription/initiate`, or by an
> admin, or seeded — has no `payment_ref`, so **it is force-expired 7 days after creation
> regardless of its `end_date`**. Paying customers lose access on day 8.
>
> **Correct rule:** expire only when `end_date < now`. Trials get an `end_date` at creation, so
> they need no special case. See [09-known-defects.md](09-known-defects.md#saas-1).

Being in-process also means: two server instances run it twice, and zero instances run it never.
Move it to a proper scheduler.

### Access gate (`requireMilkmanSubscription`) — written, never mounted

Intended behaviour, which you should implement and actually mount:

```
no subscription row at all:
    trial window = users.created_at + 7 days
    if past → insert an 'expired' trial row, respond 402
    else    → allow

trial (status==='trial' or plan_id IS NULL):
    if effectiveEnd < now → set status='expired', respond 402 (trialExpired: true)

active:
    if effectiveEnd < now → set status='expired', respond 402 (trialExpired: false)

expired | cancelled | pending_payment:
    respond 402
```

`effectiveEnd = end_date ?? (start_date ?? created_at) + (trial ? 7 days : 1 month)`.

**402 body:**
```json
{ "success": false, "subscriptionRequired": true, "trialExpired": true|false, "message": "…" }
```
The client intercepts 402 and routes to `/select-plan`.

---

<a id="customer-limit-enforcement"></a>

## 4.6 Customer limit enforcement

The core monetisation rule: a milkman may only serve as many customers as their plan allows.

### At approval — `POST /api/milkman/approve-customer/:customerId`

```js
sub = milkman_subscriptions WHERE milkman_id = me AND status IN ('active','trial')
        ORDER BY created_at DESC LIMIT 1
if (!sub) → 400 { subscriptionRequired: true }

approvedCustomers = count(users WHERE milkman_id = me
                                 AND role = 'customer'
                                 AND is_approved = true)

limit = sub.status === 'trial'
          ? (sub.trial_customer_limit ?? 5)
          : sub.plan.max_customers          // via platform_subscription_plans join

if (limit && approvedCustomers >= limit)
    → 400 { customerLimitReached: true, currentCount, maxAllowed, subscriptionType }
```

**Only `is_approved = true` customers count.** Pending and rejected customers are free.

If `status === 'active'` but `max_customers` is null/0, **the check passes** — an active
subscription with a misconfigured plan is effectively unlimited.

### At registration — `POST /auth/register-customer`

A weaker pre-check, so a customer isn't onboarded into a milkman who can't accept them:

```js
if (subscription.status === 'trial' && subscription.trial_customer_limit) {
    customerCount = count(users WHERE milkman_id = X AND role = 'customer')   // ⚠️ no is_approved filter
    if (customerCount >= trial_customer_limit) → 400
}
```

> ⚠️ **Two inconsistencies.** This counts *all* customers including pending/rejected, whereas
> approval counts only approved ones — so a milkman with 5 pending signups can't receive a 6th
> even though they have 0 approved. And this check only runs for **trials**; a paid milkman at
> their `max_customers` ceiling accepts unlimited registrations and only discovers the problem
> at approval time. **Make both checks identical.**

### Near-limit warning

`GET /api/milkman/subscription/status` returns:
```js
nearLimit = customerCount >= limit * 0.8 || (limit - customerCount) <= 1
```
The UI uses this to nudge an upgrade.

---

## 4.7 Milkman dashboard stats

`GET /api/milkman/stats`

```js
approvedCustomerIds = users WHERE milkman_id=me AND role='customer' AND is_approved=true

totalCustomers      = count(approvedCustomerIds)
activeSubscriptions = count(subscriptions WHERE milkman_id=me AND is_active
                                            AND customer_id IN approvedCustomerIds)
todayDeliveries     = count(all deliveries of mine where businessDate(delivery_date) = today)
pendingOrders       = count(deliveries WHERE status IN ('pending','planned','in-progress'))
pendingApprovals    = count(pending customers) + count(pending quantity_change_requests)
```

**Monthly revenue:**
```js
// per delivered row this month:
subUnitRate = sub.monthly_price > 0
                ? round2(sub.monthly_price / (30 * sub.quantity))   // ⚠️ hardcoded 30
                : 60                                                // ⚠️ fallback differs from billing's 65
price = delivery.price_per_unit ?? subUnitRate ?? 60
qty   = delivery.quantity_delivered ?? delivery.quantity ?? 1

monthlyDeliveryRevenue  = Σ (qty × price)
monthlyPurchasesRevenue = Σ product_purchases.total_amount   // this month, status ≠ 'cancelled'
monthlyRevenue          = round2(monthlyDeliveryRevenue + monthlyPurchasesRevenue)

paidAmount  = Σ payments.amount   // verified, this month, customers of mine
pendingDues = max(0, monthlyRevenue - paidAmount)
```

The `/30` and the `60` fallback both differ from the customer bill's `/daysInMonth` and `65`.
**Unify.**

---

## 4.8 Milkman earnings

`GET /api/milkman/earnings?range=…&month=YYYY-MM`

Fetches **every** delivery, purchase and payment for the milkman with no date bound, then
buckets in memory.

```js
today    = midnight today (server local time)
weekAgo  = today − 7 days
monthAgo = 1st of the current month
```

**Milk revenue per delivered row** — same rate chain as stats:
```js
subUnitRate  = sub.monthly_price > 0 ? round2(sub.monthly_price / (30 * sub.quantity)) : 60
pricePerUnit = delivery.price_per_unit ?? subUnitRate ?? 60
qty          = delivery.quantity_delivered ?? delivery.quantity ?? 1
amount       = delivery.total_amount ?? (qty × pricePerUnit)
```
Because `total_amount` was written as `qty × 75` at delivery time, that 75 wins over the
correctly-derived rate whenever the row was marked delivered. This is the root of the
milkman↔customer revenue mismatch.

**Product revenue:** `Σ total_amount` for non-cancelled purchases, bucketed on
`delivered_at ?? purchase_date`.

**Collections:** `Σ payments.amount` for verified payments, bucketed on `paid_at ?? created_at`.

**Derived:**
```js
totalEarnings   = Σ milk + Σ products       // billed
totalCollected  = Σ verified payments       // received
pendingDues     = max(0, totalEarnings − totalCollected)
monthPendingDues= max(0, monthEarnings − monthCollected)
topProducts     = products grouped by name, sorted by revenue desc, top 5
recentTransactions = deliveries + purchases + payments, sorted by date desc, capped at 60
```

`extraMilkRevenue` and `allTimeExtraMilkRevenue` are returned but hardcoded to `0`.

> ⚠️ Unbounded queries. A milkman with 100 customers after two years has ~73,000 delivery rows
> fetched and summed in Node on every page load. **Aggregate in SQL with a date filter.**

---

## 4.9 Quantity changes

Two paths with **different semantics** — a genuine design inconsistency to resolve.

### Path A — immediate (what the customer UI uses)

`POST /api/customer/deliveries/change-quantity { date, quantity, notes, subscriptionId }`

1. Reject if `quantity` is not a positive number.
2. Resolve subscription: by `subscriptionId`, else the customer's most recent active one.
3. **Reject if the delivery for that date is already `delivered`.**
4. Update that delivery's `quantity` (or create the row with the new quantity).
5. Upsert a `quantity_change_requests` row with **`status = 'accepted'`** — already approved.
6. Notify the milkman: *"adjusted today's quantity to NL (+XL more / XL less)"*.

No approval. The milkman is informed, not asked.

### Path B — request/approve

`POST /api/customer/quantity-change-request` creates `status = 'pending'`.

`PATCH|PUT /api/milkman/quantity-change-requests/:id { status, response_notes }` with
`status ∈ {accepted, rejected}`. On `accepted`:

```js
UPDATE deliveries SET quantity = requested_quantity
  WHERE customer_id = … AND delivery_date = …      // ⚠️ no subscription_id filter

if (no other pending requests for this customer+date):
    UPDATE subscriptions SET quantity = requested_quantity
      WHERE customer_id = … AND is_active = true   // ⚠️ permanent, and all subscriptions
```

> ⚠️ **Two serious bugs.**
> 1. Accepting a **one-day** quantity change permanently rewrites the subscription's standard
>    quantity. Every future delivery changes. That is not what either party asked for.
> 2. Neither update filters by `subscription_id`, so a multi-plan customer has **all** their
>    plans changed.
>
> **Correct:** a one-day change touches only that one delivery row. A permanent change is a
> plan change. See [09-known-defects.md](09-known-defects.md#qty-1).

### Precedence when reading a day's quantity

```
delivery.quantity                     (if a row exists)
  else accepted quantity_change_request.requested_quantity
  else subscription.quantity
  else 1
```

---

## 4.10 Plan changes

### Customer creates

`POST /api/customer/plan-change-requests { planId, subscriptionId, requestNotes }`

Validations:
- `planId` required; **`requestNotes` required and non-empty** ("Please provide a clear reason").
- The customer must have a `milkman_id`.
- The target plan must belong to that milkman and be `is_active`.
- The target plan must differ from the subscription's current plan → else 400.
- No pending request may already exist for that subscription → else 409.
  (The DB's partial unique index is stricter: one pending per *customer*.)

The row snapshots both sides — current and requested name, quantity, unit and monthly price —
so the milkman sees a full before/after even if a plan is later edited.

### Milkman approves

`PATCH /api/milkman/plan-change-requests/:id/approve { adjustedDetails? }`

Five validations run first:
1. No **other** pending request for this customer → else 409.
2. The requested plan still exists, is active, and belongs to this milkman → else 400.
3. Warn (log only) if the customer has >1 active subscription.
4. `monthly_price >= 0` → else 400.
5. `quantity > 0` → else 400.

The milkman may override any field via `adjustedDetails` (quantity, delivery_time, product_name,
monthly_price, unit, frequency).

Then the **existing subscription is rewritten in place** — `plan_id`, `product_name`, `quantity`,
`unit`, `frequency`, `delivery_time`, `monthly_price`, `is_active = true`. If the customer had
no subscription, a new one is created. The request goes to `status = 'accepted'` and the customer
is notified.

> Rewriting in place means **no history**. The old plan is gone; a bill spanning the change date
> uses the new price for the whole month. If you need mid-month proration, version subscriptions
> instead (close the old row with an `end_date`, open a new one).

### Second, divergent implementation

`PUT /api/milkman/plan-change-requests/:id { status, responseNotes }` calls the Postgres RPC
`resolve_plan_change_request(...)` — a completely separate implementation of the same rule with
none of the five validations above. **Delete one of these on rebuild.**

---

## 4.11 Product purchases

`POST /api/customer/purchase-product { productId, quantity }`

```js
require productId and quantity > 0
require product.is_available && product.available_quantity > 0
require product.available_quantity >= requestedQty     // else "Only N <unit> available"
require product.price_per_unit >= 0

totalAmount = round2(product.price_per_unit × requestedQty)

INSERT product_purchases {
  product_id, customer_id, milkman_id: product.milkman_id,
  customer_address: "<street>, <area>, <city> - <pincode> (Near <landmark>)",
  quantity, price_per_unit: product.price_per_unit, total_amount, status: 'pending'
}

// decrement stock
newStock = max(0, product.available_quantity − requestedQty)
UPDATE daily_products SET available_quantity = newStock, is_available = (newStock > 0)

notify milkman with customer name, qty, unit, ₹total, address, phone
```

> ⚠️ **Stock decrement is not atomic.** Read-then-write with no transaction, no row lock and no
> DB constraint. Two concurrent orders for the last unit both succeed. **Fix with an atomic
> conditional update:**
> ```sql
> UPDATE daily_products
>    SET available_quantity = available_quantity - $qty
>  WHERE id = $id AND available_quantity >= $qty
> RETURNING *;          -- zero rows ⇒ insufficient stock
> ```

> ⚠️ Cancelling a purchase **never restores stock**. There is no compensating update anywhere.

**Status flow:** `pending → accepted → delivered` (also `completed`, `cancelled`).
Milkman transitions via `/product-purchases/:id/accept`, `/deliver`, `/status`.

The address is flattened into a text snapshot at purchase time, so later address edits don't
rewrite delivery history. That's deliberate and correct.

---

## 4.12 Customer payments

### Customer submits

`POST /api/payments/submit-offline-payment { billId, paymentMethod, utrNumber, amount, note }`

1. `billId` may be a UUID **or** a `'YYYY-MM'` month string. If it contains `-` and isn't a UUID,
   it's treated as the target month.
2. `dueDate` = last day of that month.
3. Find or create the `monthly_bills` row for `(customer, month)`.
   - **If it exists, `total_amount` is deliberately not mutated** (the code comments this as a
     "financial integrity fix"). Only `payment_status` → `'pending'` and `notes` are touched.
   - If not, create it with `total_amount = submitted amount` — which is wrong whenever the
     customer part-pays, but it's the only number available at that moment.
4. Insert into `payments` with `status = 'initiated'`, and:
   - `razorpay_payment_id = 'UTR-<utr>'` or `'PAYTM-<timestamp>'`
   - `failure_reason = note` ← the customer's note in a field named "failure reason"
5. Notify the milkman.

> Overloading `razorpay_payment_id` and `failure_reason` is why these should be first-class
> columns: `reference` and `customer_note`.

### Milkman verifies

`POST /api/payments/milkman/verify-offline-payment { paymentId, status }`

**Authorization** (any one suffices): the payer's `users.milkman_id` is me, or their
`assigned_milkman_id` is me, or a `subscriptions` row links that customer to me. Else 403.

```js
isSuccess = status IN ('completed','success')
payments.status = isSuccess ? 'success' : 'failed'
payments.paid_at = isSuccess ? now : NULL
```

On success, update the bill ledger:
```js
bill = monthly_bills by payment.bill_id, else by (customer, businessMonth(payment.created_at))

newPaidAmount = bill.paid_amount + payment.amount
newStatus = newPaidAmount >= bill.total_amount && bill.total_amount > 0 ? 'paid'
          : newPaidAmount > 0                                           ? 'partially_paid'
          :                                                               'pending'

UPDATE monthly_bills SET payment_status = newStatus,
                         paid_amount   = newPaidAmount,
                         paid_at       = (newStatus === 'paid' ? now : unchanged),
                         payment_method = payment.payment_method ?? 'UPI'
```
If no bill row exists, create one fully paid for the payment amount. Then notify the customer.

> ⚠️ `paid_amount` is incremented **without idempotency**. Verifying the same payment twice
> double-counts it. Guard on the payment's prior status (only transition from `initiated`), or
> recompute `paid_amount` as a sum over verified payments rather than incrementing.

### Razorpay (configured but dead)

`POST /api/payments/create-order` and `/verify-payment` exist and implement a standard Razorpay
order + HMAC-SHA256 signature verification flow. `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are
**not set**, so `razorpayInstance` is `null` and both endpoints fail closed. All real money moves
through the offline path above.

---

## 4.13 Pincode serviceability

`GET /api/addresses/check-pincode/:pincode` (public; uses the caller's identity if present)

Five fallbacks, first match wins:

1. **Caller's assigned milkman's `service_areas`** — match on exact pincode, or area name with
   **bidirectional substring** matching (`a.includes(b) || b.includes(a)`).
2. **Caller's assigned milkman's zones** — pincode in `zones.pincodes[]`, or area substring in
   `name`/`display_name`.
3. **Still assigned to a milkman?** → return available anyway, so an existing customer can always
   edit their address.
4. **Any milkman's `service_areas`** — same matching → returns that `milkman_id`.
5. **RPC `get_zone_by_pincode`** (does not exist; the call is wrapped in try/catch) → then the
   `zones` table scanned directly.

Finally: if the caller is logged in → available; otherwise
`{ available: false, message: "Sorry, we don't deliver to pincode <pin> yet." }`.

> Bidirectional substring matching is very loose — area "Ram" matches "Ramnagar" *and*
> "Shriram Colony". Combined with three overlapping coverage models, serviceability is
> unpredictable. **On rebuild: one normalised `service_areas` table, exact pincode match,
> plus explicit area aliases.**

---

## 4.14 Notifications

Created by `createNotification({ userId, title, message, type, relatedId })`, which **strips
emoji** from title and message before insert. Three call sites bypass the helper and insert
directly, so some rows do keep their emoji.

**Retention: 30 hours.** Reads filter `created_at >= now − 30h`, and every read fires a
background hard `DELETE` of anything older, from both `notifications` and
`milkman_notifications`.

**Unread count** = unread rows in the last 30 hours. The milkman's count additionally **adds
pending `quantity_change_requests`**, and the milkman's notification *list* synthesises
pseudo-rows for them with ids like `pending-request-<uuid>`; marking those read is a no-op.

### Events that notify

| Event | Recipient |
|---|---|
| New subscription acquired | milkman |
| Subscription paused / resumed / cancelled | milkman |
| Plan change requested | milkman |
| Plan change approved / rejected | customer |
| Quantity adjusted or requested | milkman |
| Product ordered | milkman |
| Customer registration approved / rejected | customer |
| Offline payment submitted | milkman |
| Payment verified | customer |
| Milkman submits SaaS payment | all admins |
| Admin approves/rejects SaaS payment | milkman |
| Milkman broadcast | all their customers |

### Web push

`push-notification.service.ts` implements VAPID web push with automatic cleanup of expired
subscriptions (HTTP 410 → delete the row). It is **non-functional**: `VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` are unset and the `push_subscriptions` table does not exist.

---

## 4.15 Constant reference

Every magic number in the system, in one place. **Make these configuration on rebuild.**

| Constant | Value | Where |
|---|---|---|
| Free trial length | **7 days** | trial creation, expiry sync, access gate |
| Trial customer limit | **5** | trial creation, limit checks |
| Paid subscription length | **30 days** | UTR submission, admin approval |
| JWT lifetime | **7 days** | all login handlers |
| Notification retention | **30 hours** | reads and purge |
| Expiry sync interval | **5 minutes** | server boot |
| Client session re-verify | **5 minutes** | all three `ProtectedRoute`s |
| Notification poll | **8 s** (milkman) / **10 s** (customer, admin) | NotificationBell |
| Subscription-status poll | **60 s** | milkman MainLayout |
| Request-count poll | **30 s** | milkman layout/sidebar |
| Near-limit threshold | **80%** or ≤1 remaining | subscription status |
| Default ₹/L — billing fallback | **65** | billing breakdown |
| Default ₹/L — stats/earnings fallback | **60** | milkman stats, earnings |
| Default ₹/L — delivery amount fallback | **75** | delivery status update |
| Days/month — billing | **actual (28–31)** | billing breakdown |
| Days/month — stats/earnings | **30 (hardcoded)** | milkman stats, earnings |
| Default city / state | **Gurugram / Haryana** | ~12 hardcoded fallbacks |
| Max delivery quantity | **100** | `deliveries.quantity` CHECK |
| Request body limit | **10 MB** | Express json/urlencoded |
| Default page size | **50**, max **200** | paginated list endpoints |

> The three different ₹/L fallbacks (65/60/75) and the two different month lengths
> (actual/30) are the direct cause of the milkman's earnings never matching the sum of their
> customers' bills. **One rate resolver, one calendar function.**
