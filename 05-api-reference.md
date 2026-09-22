# 5. API Reference

Base URL: `${VITE_API_URL}` = `http://localhost:3001/api` in development.

**Auth column:** `—` public · `C` customer · `M` milkman · `A` admin · `*` any authenticated.

**Global conventions**

- Auth: `Authorization: Bearer <jwt>`.
- Errors: `{ "message": "..." }`. 500s are masked to `"An internal server error occurred"`
  outside development.
- Paginated list endpoints take `?limit=` (default 50, max 200) and `?offset=` (default 0) and
  return `{ success, data, pagination: { limit, offset } }`.
- **Response shapes are wildly inconsistent** — some endpoints return a bare array, some
  `{ data }`, some `{ success, data }`, some `{ data, requests }` (the same array twice under two
  keys, for client-compat). Several objects carry every field in **both** `snake_case` and
  `camelCase`. **Normalise this on rebuild**; the duplication exists purely to absorb client drift.

---

## 5.1 Auth — `/api/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/verify-status` | — (self-checks token) | Validate session; returns `{valid, userId, role, isVerified?, user}`. Enforces customer approval (403) and returns milkman `is_verified`. |
| POST | `/login` | — | Email **or** phone + password. Returns `{user, token}`. Largely unused. |
| POST | `/register` | — | Generic registration. Largely unused. |
| POST | `/google` | — | **Customer** Google login. Body `{credential}`. User must exist, be `role='customer'` and approved. |
| POST | `/google-milkman` | — | **Milkman** Google login. Body `{credential}`. |
| POST | `/google-login` | — | **Admin** Google login. Body `{credential, role:'admin'}`. Allowlist-gated; auto-creates/upgrades the admin user. |
| POST | `/register-customer` | — | Full customer signup + address. See [03](03-auth-and-roles.md#32-registration). |
| GET·POST | `/check-approval-status` | — | ⚠️ **Mints a 7-day JWT from an email or phone alone.** Must be removed or authenticated. |
| GET | `/debug-db-3` | — | Dev-only debug route (`NODE_ENV !== 'production'`). Remove. |

**Login request/response**

```jsonc
// POST /api/auth/google        ← note: field is "credential", NOT "token"
{ "credential": "<google id token>" }

// 200
{ "user": { "id","name","email","phone","role","address",
            "isApproved","approvalStatus","createdAt" },
  "token": "<app jwt, 7d>" }

// 403 — pending/rejected customer
{ "message": "...", "status": "pending"|"rejected",
  "customer": {...}, "milkman": {...} }

// 404 — not registered
{ "message": "Email not registered...", "requiresRegistration": true }
```

---

## 5.2 Public / shared — `/api`

Mounted **before** the milkman router so these stay reachable when a milkman is paywalled.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/plans/active` | — | Active platform (SaaS) plans. Seeds 3 defaults if the table is empty. |
| GET | `/subscription/plans` | — | Alias of the above. |
| GET | `/subscription/plans/active` | — | Alias of the above. |
| GET | `/milkmen/active` | — | Milkmen accepting signups (for the picker). |
| GET | `/milkmen/:milkmanId/delivery-areas` | — | That milkman's coverage areas. |
| GET | `/milkmen/:milkmanId/subscription-plans` | — | That milkman's milk plans, for signup preview. |
| GET | `/milkman/subscription/status` | M | Full SaaS status — see shape below. |
| POST | `/milkman/subscription/free-trial` | M | Start the 7-day trial. 400 if already used. |
| POST | `/milkman/subscription/initiate` | M | ⚠️ Writes `status='pending_payment'`, which violates the CHECK constraint. Dead. |
| POST | `/milkman/subscription/cancel` | M | Cancel active/trial. |
| GET | `/subscription/admin-payment-info` | * | Platform UPI ID / QR / bank details. |
| GET | `/milkman/admin-payment-info` | * | Alias of the above. |
| POST | `/milkman/subscription/submit-payment` | M | `{planId, transactionRef}` → `status='pending'`; notifies admins. |

**`GET /milkman/subscription/status` response** — the milkman client gates on this:

```jsonc
{
  "success": true,
  "hasActiveSubscription": true,   // active sub, OR a live trial
  "isTrial": false,
  "trialExpired": false,
  "pendingVerification": false,    // a 'pending' UTR submission exists
  "daysRemaining": 23,
  "subscription": { /* milkman_subscriptions row + joined plan */ },
  "isVerified": true,              // milkman_profiles.is_verified
  "customerCount": 18,
  "customerLimit": 25,
  "nearLimit": false,              // >=80% or <=1 remaining
  "planName": "Starter Plan",
  "endDate": "2026-10-22T…"
}
```

Client rule: `isVerified && hasActiveSubscription && !trialExpired && !pendingVerification`
→ allow the panel. Otherwise redirect to `/select-plan`.

---

## 5.3 Customer — `/api/customer`  (all `C`)

### Profile and stats

| Method | Path | Notes |
|---|---|---|
| GET | `/stats` | `{activeSubscriptions, todayDeliveries, totalDeliveries, monthlyRevenue:0}` |
| PUT | `/profile` | `{name?, phone?}` — partial |
| PATCH | `/profile` | `{name, phone}` — both required, phone must be exactly 10 digits |
| GET | `/addresses` | default first, then newest |

### Subscriptions

| Method | Path | Notes |
|---|---|---|
| GET | `/subscriptions` | All the customer's subscriptions, enriched with plan data. Fields in both cases. |
| POST | `/subscriptions` | `{planId, deliveryTime?, quantity?, startDate?}` → acquire an **additional** plan. Creates today's delivery if `startDate <= today`. Notifies milkman. |
| GET | `/subscription-plans` · `/available-plans` | Plans from **the customer's assigned milkman only**. |
| POST | `/subscribe-plan` | `{planId}` — legacy single-plan path. ⚠️ Touches the non-existent `products` table. |
| PATCH | `/subscriptions/:id/pause` | → `is_active=false, status='paused'`; notifies milkman |
| PATCH | `/subscriptions/:id/resume` | → `is_active=true, status='active', paused_until=null` |
| PATCH | `/subscriptions/:id/cancel` | → `status='cancelled', end_date=today`; deletes today's *pending* delivery |
| DELETE | `/subscriptions/:id` | Hard delete |

### Plan change requests

| Method | Path | Notes |
|---|---|---|
| GET | `/plan-change-requests` | Own requests, newest first |
| POST | `/plan-change-requests` · `/plan-change-request` | `{planId, subscriptionId?, requestNotes}` — **notes required**. 409 if one is pending. |

### Deliveries

| Method | Path | Notes |
|---|---|---|
| GET | `/deliveries/today` | Per-subscription status for today; `totalTodayQuantity`, `activePlansCount` |
| POST | `/deliveries/skip-date` | `{date?, reason?, subscriptionId?}` → status `skipped`, `total_amount=0` |
| POST | `/deliveries/resume-date` | `{date?, subscriptionId?}` → back to `pending` |
| POST | `/deliveries/change-quantity` | `{date?, quantity, notes?, subscriptionId?}` → **applies immediately**; 400 if already delivered |
| GET | `/deliveries/history?month=YYYY-MM` | **`month` required.** Milk + product orders merged, with a summary |
| GET | `/deliveries/billing-breakdown?month=YYYY-MM` | **The bill.** See [04](04-business-logic.md#42-customer-monthly-bill) |

**`GET /deliveries/today` response:**
```jsonc
{ "success": true, "date": "2026-09-22",
  "subscription": {...}, "subscriptions": [...],
  "deliveryStatus": {...},              // the first entry, for single-plan UIs
  "deliveryStatuses": [ {
      "subscriptionId","status","quantity","standardQuantity","productName",
      "slot","deliveredAt","reason","monthlyPrice",
      "pendingQuantityRequest": { "id","requested_quantity","current_quantity",
                                  "status","request_notes","response_notes" } | null
  } ],
  "totalTodayQuantity": 1.5, "activePlansCount": 2 }
```

### Quantity change requests

| Method | Path | Notes |
|---|---|---|
| POST | `/quantity-change-request` | Creates a **pending** request (approval path) |
| GET | `/quantity-change-requests` | Own requests |

### Products and orders

| Method | Path | Notes |
|---|---|---|
| GET | `/available-products` | Catalog of the customer's milkman. Resolves milkman via user → subscription → delivery history. |
| POST | `/purchase-product` | `{productId, quantity}` — validates stock, decrements it, notifies milkman |
| GET | `/purchase-history` · `/my-orders` | Identical; purchases joined to product name/unit |
| GET | `/orders/recent` | Last 50 deliveries as "orders"; falls back to synthesising from active subscriptions |
| GET | `/products` | ⚠️ Queries the non-existent `products` table. Always empty. |

### Billing and notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/invoices/history?limit=&offset=` | Monthly bills; synthesises a month list if none exist; recomputes zero/current-month totals |
| GET | `/milkman-payment-info` | Assigned milkman's UPI ID, QR URL, business name, phone |
| GET | `/notifications` | Last 30 hours |
| GET | `/notifications/unread-count` | `{count}` |
| PATCH | `/notifications/:id/read` | |
| PATCH | `/notifications/mark-all-read` | |

---

## 5.4 Milkman — `/api/milkman`  (all `M`)

### Dashboard and profile

| Method | Path | Notes |
|---|---|---|
| GET | `/stats` | See [04](04-business-logic.md#47-milkman-dashboard-stats) |
| GET | `/profile` | `{user, profile}`; returns an empty profile skeleton if none exists |
| POST·PUT·PATCH | `/profile` | `{name?, phone?, business_name?, business_address?, upi_id?, qr_code_url?, service_areas?}` — upserts |
| GET | `/earnings?range=&month=` | See [04](04-business-logic.md#48-milkman-earnings) |

### Customers

| Method | Path | Notes |
|---|---|---|
| GET | `/customers` | **Approved only**, with all subscriptions, totals and default address flattened |
| GET | `/customers/:id` | Full detail: subscriptions, live current bill, payments, last 10 deliveries |
| GET | `/pending-customers` | Awaiting approval, with their prospective subscription |
| PUT·PATCH | `/customers/:id` | Update name/phone/address. Tenant-checked. |
| POST | `/customers/:id/update` | Alias of the above |
| POST | `/approve-customer/:customerId` | **Enforces the plan customer limit**; activates subscription; creates today's delivery |
| POST | `/reject-customer/:customerId` | `{reason?}` → rejected; deactivates subscriptions; **deletes pending deliveries** |

**Customer-limit rejection (400):**
```jsonc
{ "success": false,
  "message": "Plan customer limit reached (25 customers)...",
  "customerLimitReached": true,
  "currentCount": 25, "maxAllowed": 25, "subscriptionType": "active" }
```

### Deliveries

| Method | Path | Notes |
|---|---|---|
| GET | `/deliveries/today` | Raw rows for today |
| GET | `/deliveries/date?date=YYYY-MM-DD` | **The round view.** Virtual — built from subscriptions; ids may be `temp-…` |
| POST | `/deliveries/update-status` | `{customerId, subscriptionId?, date, status, quantity?, reason?}`. Lazily creates the row. |
| POST | `/deliveries/bulk-day-off` | `{date, reason?}` → every stop `skipped`, ₹0 |
| GET | `/delivery-history?period=` | Historic deliveries |
| GET | `/delivery-route` | Today's route rows |
| POST | `/admin/generate-daily-deliveries` | Idempotent-ish generation job. **Nothing calls it.** |
| POST | `/test-delivery-insert` | Diagnostic. Remove. |

`status ∈ { delivered, undelivered, skipped, pending }` — anything else is a 400.

### Plans and products

| Method | Path | Notes |
|---|---|---|
| GET·POST | `/subscription-plans` | List / create milk plans |
| PUT·DELETE | `/subscription-plans/:planId` | Update / delete |
| POST | `/subscriptions/create` | Assign a subscription directly to a customer |
| PATCH | `/subscriptions/:id/pause` · `/resume` | |
| DELETE | `/subscriptions/:id` | |
| GET·POST | `/daily-products` | Catalog list / create |
| PUT·DELETE | `/daily-products/:id` | |
| PATCH | `/daily-products/:id/toggle` | Toggle availability |
| GET | `/product-purchases` | Incoming orders |
| POST | `/product-purchases/:id/accept` | |
| PATCH | `/product-purchases/:id/deliver` · `/status` | |

### Requests

| Method | Path | Notes |
|---|---|---|
| GET | `/quantity-change-requests?status=` | With customer data manually joined |
| PATCH·PUT | `/quantity-change-requests/:id` | `{status: accepted\|rejected, response_notes?}` |
| GET | `/plan-change-requests` | |
| PATCH | `/plan-change-requests/:requestId/approve` | `{adjustedDetails?}` — 5 validations, rewrites the subscription |
| PATCH | `/plan-change-requests/:requestId/reject` | |
| PUT | `/plan-change-requests/:id` | ⚠️ Second implementation via the `resolve_plan_change_request` RPC |

### Areas and comms

| Method | Path | Notes |
|---|---|---|
| GET·POST | `/delivery-areas` | |
| PUT·DELETE | `/delivery-areas/:id` | |
| PATCH | `/delivery-areas/:id/toggle` | |
| POST | `/broadcast` | Notify all the milkman's customers |
| GET | `/notifications` | Last 30 h, **plus synthetic rows for pending quantity requests** |
| GET | `/notifications/unread-count` | Unread + pending request count |
| PATCH | `/notifications/:id/read` · `/mark-all-read` | `pending-request-*` ids are no-ops |

---

## 5.5 Admin — `/api/admin`  (all `A`)

| Method | Path | Notes |
|---|---|---|
| GET | `/stats` | Platform KPIs + a 6-item recent-activity feed |
| GET | `/analytics` | Revenue, plan distribution, regional density. ⚠️ Reads the non-existent `platform_plans`. |
| GET | `/milkmen` | All milkmen with profile and subscription |
| GET | `/milkmen/:id` | Detail |
| POST | `/milkmen/:id/verify` | `is_verified=true`; creates the profile if missing |
| POST | `/milkmen/:id/suspend` · `/milkman/:id/suspend` | `is_verified=false` **and** cancels active/trial subscriptions |
| GET·POST | `/platform-plans` | SaaS plan CRUD |
| PUT·DELETE | `/platform-plans/:id` | |
| GET | `/payments` | All platform payments |
| GET | `/subscriptions/pending-verifications` | UTR submissions awaiting review |
| POST | `/subscriptions/:subscriptionId/verify` | `{action:'approve'\|'reject', rejectReason?}` |
| GET·POST | `/platform-settings` | Platform UPI/QR/bank/support phone |
| GET | `/notifications`, `/notifications/unread-count` | |
| PATCH | `/notifications/:id/read`, `/notifications/mark-all-read` | |
| GET | `/debug-db` | Dev-only. Remove. |

**`GET /admin/stats` response:**
```jsonc
{ "success": true, "stats": {
    "totalMilkmen", "activeMilkmen", "pendingMilkmen", "totalCustomers",
    "monthlyRevenue", "todayRevenue", "activeSubscriptions", "pendingPayments",
    "recentActivities": [ { "id","title","subtitle","time","type","badgeColor" } ]
} }
```
> `badgeColor` is a **Tailwind class string returned by the API**. Presentation must not live in
> the API — return a semantic `severity` and let the client map it.

---

## 5.6 Addresses — `/api/addresses` (also mounted at `/api/pincodes`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/check-pincode/:pincode` | — | Serviceability. See [04](04-business-logic.md#413-pincode-serviceability) |
| GET | `/check/:pincode` | — | Alias |
| GET | `/` | * | Own addresses |
| GET | `/default` | * | Default address |
| POST | `/` | * | Create |
| PUT | `/:id` | * | Update |
| PATCH | `/:id/set-default` | * | Promote to default |
| DELETE | `/:id` | * | Delete |

---

## 5.7 Zones — `/api/zones`  (auth required)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | * | All zones |
| GET | `/my-zones` | M | Assigned zones |
| GET | `/my-customers` | M | Customers in those zones |
| GET | `/delivery-route/today` | M | Today's route by zone |
| GET | `/:zoneId/customers` | M | Customers in one zone |

---

## 5.8 Payments — `/api/payments`  (auth required)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/create-order` | C | Razorpay order. **Fails — unconfigured.** |
| POST | `/verify-payment` | C | Razorpay HMAC-SHA256 verify. **Fails — unconfigured.** |
| GET | `/history` | C | Own payments |
| GET | `/:paymentId` | C | One payment |
| GET | `/milkman/all` | M | All payments from the milkman's customers |
| POST | `/submit-offline-payment` | C | **The live path.** `{billId, paymentMethod, utrNumber, amount, note}` |
| POST | `/milkman/verify-offline-payment` | M | **The live path.** `{paymentId, status}` → updates the bill ledger |

> `GET /:paymentId` is declared **after** `/history` and `/milkman/all`, so those literal paths
> win. Keep that ordering, or use a non-colliding prefix.

---

## 5.9 Push notifications — `/api/push-notifications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/subscribe` | * | Store a browser PushSubscription |
| POST | `/test` | * | Send a test push |
| GET | `/vapid-key` | — | Public VAPID key |
| POST | `/broadcast` | * | Broadcast to a user type |

**Entirely non-functional**: VAPID keys unset and `push_subscriptions` doesn't exist.
The client also calls `POST /push-notifications/unsubscribe`, which is **not implemented**.

---

## 5.10 Health

`GET /health` → `{ "status": "OK", "message": "Server is running" }`. No auth, no DB check.
Make it check the database on rebuild.

---

## 5.11 Frontend calls with no backend route

17 calls in the shipped clients hit endpoints that do not exist. All but one live in
[dead pages](06-frontend-customer.md#dead-pages); they are listed here so you don't
recreate them.

| Call | App | Status |
|---|---|---|
| `GET/POST/DELETE /customer/additional-orders[/:id]` | customer | routes deleted server-side; page is dead |
| `GET/POST/PUT/DELETE /milkman/products[/:id]` | milkman | superseded by `/daily-products`; page is dead |
| `PATCH /milkman/products/:id/toggle-availability` | milkman | ditto |
| `GET /milkman/additional-orders/pending` | milkman | dead page |
| `POST /milkman/additional-orders/:id/approve` · `/reject` | milkman | dead page |
| `GET /milkman/approvals/pending` | milkman | dead page |
| `PATCH /milkman/approvals/:id/items/:itemId/approve` · `/reject` | milkman | dead page |
| `PATCH /milkman/customers/:id/subscription-quantity` | milkman | dead page |
| `POST /milkman/broadcast-announcement` | milkman | dead page (live one is `/broadcast`) |
| `POST /subscription/submit-payment-request` | milkman | dead page (live one is `/milkman/subscription/submit-payment`) |
| `POST /push-notifications/unsubscribe` | milkman | **live code path** — implement it or remove the caller |

---

## 5.12 Endpoint aliases to drop

Maintained purely for client-compat. Collapse each group to one on rebuild.

| Canonical | Aliases |
|---|---|
| `GET /plans/active` | `/subscription/plans`, `/subscription/plans/active` |
| `GET /subscription/admin-payment-info` | `/milkman/admin-payment-info` |
| `GET /customer/subscription-plans` | `/customer/available-plans` |
| `POST /customer/plan-change-requests` | `/customer/plan-change-request` |
| `GET /customer/purchase-history` | `/customer/my-orders` |
| `PUT /milkman/profile` | `POST`, `PATCH` on the same path |
| `PUT /milkman/customers/:id` | `PATCH /:id`, `POST /:id/update` |
| `PATCH /milkman/quantity-change-requests/:id` | `PUT` same path |
| `POST /admin/milkmen/:id/suspend` | `/admin/milkman/:id/suspend` |
| `GET /addresses/check-pincode/:pincode` | `/addresses/check/:pincode` |
| `POST /auth/check-approval-status` | `GET` same path |
