# 7. Milkman Portal

`client-milkman` · dev port **5174** · installable PWA · en / hi / gu.

This is the operational hub and the hardest screen set in the product. The milkman uses it
**one-handed, outdoors, at 05:00, on a motorbike round**, often on a low-end Android with patchy
connectivity. Everything below follows from that: big tap targets, status changes in one tap,
tabs instead of navigation, aggressive caching, and a UI that keeps working when a request fails.

## 7.1 Shell

```
GoogleOAuthProvider (app-level, VITE_GOOGLE_CLIENT_ID)
└── LanguageProvider
    └── BrowserRouter
        ├── AppOpenAnimation        splash: "Milkman Portal"
        ├── PWAInstallBanner
        ├── Toaster                 top-center pills
        └── Routes
            ├── /login          MilkmanLogin                      (public)
            ├── /select-plan    PlanSelection      (authed, NOT behind ProtectedRoute)
            └── /               ProtectedRoute → MainLayout
                ├── index                 Dashboard
                ├── /deliveries           CombinedDeliveriesProducts
                ├── /customers            CombinedCustomers
                ├── /customers/:id        CustomerDetail
                ├── /plan-change-requests PlanChangeRequests
                ├── /delivery-route       CombinedLogistics
                ├── /subscription-plans   CombinedPlans
                ├── /earnings             Earnings
                ├── /profile              Profile
                └── /settings             Settings
```

**Tab redirects** — older routes now point into a tab of a combined page:

| Old route | Redirects to |
|---|---|
| `/pending-customers` | `/customers?tab=pending` |
| `/quantity-requests` | `/deliveries?tab=quantity` |
| `/delivery-areas` | `/delivery-route?tab=areas` |
| `/daily-products` | `/deliveries?tab=catalog` |
| `/product-purchases` | `/deliveries?tab=orders` |
| `/history` | `/deliveries?tab=orders&subtab=history` |

`/select-plan` sits **outside** `ProtectedRoute` deliberately — a paywalled milkman must still be
able to reach it.

### ProtectedRoute — the paywall gate

On mount, then every **5 minutes**:

1. Rehydrate from `localStorage` (`token`, `user`).
2. `role === 'customer'` → hard-redirect to the customer origin (`5174`→`5173`).
3. `role !== 'milkman'` → deny.
4. `Promise.allSettled([ GET /auth/verify-status, GET /milkman/subscription/status ])`.
5. Grant access **only if**:
   ```js
   verify.valid
     && (verify.isVerified ?? true)
     && sub.hasActiveSubscription && !sub.trialExpired && !sub.pendingVerification
   ```
6. Otherwise `<Navigate to="/select-plan">`.

**Deliberately does not log out on failure** — only a 401 denies, and even then the session is
left intact. A network blip must not evict a milkman mid-round.

> ⚠️ **This is the only place the paywall is enforced.** The server middleware
> (`requireMilkmanSubscription`) is never mounted, so the API happily serves an expired milkman.
> See [09-known-defects.md](09-known-defects.md#auth-2).

### MainLayout

Header + Sidebar + `<Outlet/>` + a 5-slot bottom bar on mobile:
**Home** `/` · **Requests** `/plan-change-requests` (red badge) · **Orders** `/deliveries` ·
**Customers** `/customers` · **Menu** (opens the drawer).

Background polling from the layout: subscription status every **60 s** (redirect to
`/select-plan` if it lapses) and pending plan-change count every **30 s**, both also on window
focus. The sidebar separately polls pending quantity requests every **30 s**.

> Four independent polling loops plus a 5-minute re-verify plus an 8-second notification poll.
> **Replace with one subscription channel on rebuild** — see
> [10-rebuild-guide.md](10-rebuild-guide.md#realtime).

**Sidebar:** Dashboard · Deliveries & Products (badge) · Customers & Approvals ·
Plan Change Requests (badge) · Route & Sectors · Plans & Membership · Earnings & Payouts ·
Profile & Settings.

## 7.2 MilkmanLogin — `/login`

Google only. `POST /auth/google-milkman { credential, email, name, picture }`. On success,
persist and navigate to `/`; `ProtectedRoute` then decides between the panel and `/select-plan`.

## 7.3 PlanSelection — `/select-plan`

Shown whenever the milkman is unverified, out of trial, expired, or awaiting UTR verification.
It must explain **which** of those it is:

| State | Screen |
|---|---|
| Never subscribed, trial unused | Plan cards + **Start 7-day free trial** |
| Trial active | Days remaining, upgrade prompt |
| Trial expired | "Your 7-day trial has ended" + plan cards |
| Awaiting verification | "Payment submitted, awaiting admin verification" + the UTR |
| Rejected | Rejection reason + resubmit |
| Not verified by admin | "Awaiting admin verification of your business" |

**Data:** `GET /plans/active`, `/milkman/subscription/status`, `/subscription/admin-payment-info`.

**Flows:** `POST /milkman/subscription/free-trial`, or pay to the platform QR/UPI and
`POST /milkman/subscription/submit-payment { planId, transactionRef }`.

## 7.4 Dashboard — `/`

`GET /milkman/stats` + `/milkman/deliveries/today`.

Greeting, then KPI tiles — today's deliveries, active customers, active subscriptions, pending
orders, monthly revenue, collected, pending dues, pending approvals. Quick actions jump into the
round, pending approvals, and the catalog. A verification/trial banner appears when relevant.

## 7.5 CombinedDeliveriesProducts — `/deliveries`

**3,626 lines, 49 `useState` hooks in a single component.** It is the operational core and the
single worst file in the codebase. The *functionality* below is right; the implementation must
be decomposed on rebuild.

Four tabs, synced to `?tab=`:

| Tab | `?tab=` | Purpose |
|---|---|---|
| **Milk round** | `milk` (default) | today's stops, mark delivered/undelivered/skipped |
| **Quantity requests** | `quantity` | approve/reject one-day quantity changes |
| **Catalog** | `catalog` | daily products CRUD |
| **Orders** | `orders` | incoming product purchases (`&subtab=history` for past) |

**Data (one `fetchAllHubData`):** `/milkman/customers`, `/milkman/daily-products`,
`/milkman/product-purchases`, `/milkman/quantity-change-requests?status=pending`,
`/milkman/delivery-history?period=all`.

### Milk round tab

A month calendar for date selection (prev/next/today), then the selected day's stops from
`GET /milkman/deliveries/date?date=`. Each stop shows customer name, phone (tap to call),
address, area, product, **standard quantity vs today's quantity**, slot, and status.

One-tap status change → `POST /milkman/deliveries/update-status`
`{ customerId, subscriptionId, date, status, quantity?, reason? }`.
Rows with a `temp-` id have no database row yet; the endpoint creates one.

Bulk actions: **Day off** (`POST /milkman/deliveries/bulk-day-off`) and
**Broadcast** (`POST /milkman/broadcast`).

Optimistic UI: the status pill flips immediately and rolls back on failure. This matters on a
bad connection.

### Quantity requests tab

Pending requests with current → requested quantity, date, and the customer's note.
Accept/reject → `PUT /milkman/quantity-change-requests/:id { status, response_notes }`.

> ⚠️ Accepting permanently rewrites the subscription's standard quantity, not just that one day.
> See [09-known-defects.md](09-known-defects.md#qty-1). The UI does not warn about this.

### Catalog tab

CRUD over `daily_products`. Notable: **`COMMON_DAIRY_PRESETS`** — a bundled list of standard
Indian dairy items with default units and prices (cow milk, buffalo milk, paneer, ghee, butter,
dahi, chaas, cream, mawa), offered as one-tap adds plus an "add all common presets" bulk action.
This is good onboarding — keep it.

`getDairyProductImage(name, customImageUrl)` maps a product name to one of the nine bundled
images by substring, falling back to a generic icon.

### Orders tab

Incoming `product_purchases` with customer, address, phone, quantity, amount, status.
Accept → deliver. `&subtab=history` shows completed ones.

## 7.6 CombinedCustomers — `/customers`

Tabs: **Active** (`/milkman/customers`) and **Pending** (`/milkman/pending-customers`), synced
to `?tab=`.

**Active:** searchable list — name, phone, area, plan(s), total monthly value, quantity. A
customer with several plans shows "N Active Plans". Row → `/customers/:id`. Inline edit writes
`PUT /milkman/customers/:id`.

**Pending:** the approval queue. Each card shows the customer's details, address and prospective
plan, with **Approve** / **Reject** (reason).

Approve → `POST /milkman/approve-customer/:id`. **The customer-limit rejection must be handled
explicitly** — on a 400 with `customerLimitReached`, show current/max and a direct upgrade link
rather than a generic toast.

## 7.7 CustomerDetail — `/customers/:id`

`GET /milkman/customers/:id` returns everything at once: profile, address, all subscriptions,
the live current bill (`subscription_amount`, `additional_amount`, `total_amount`, `paid_amount`,
`balance_due`, `payment_status`, `due_date`), payment history, last 10 deliveries, additional
orders.

Actions: edit details, pause/resume/delete a subscription, create a subscription
(`POST /milkman/subscriptions/create`), verify a payment
(`POST /payments/milkman/verify-offline-payment`).

## 7.8 CombinedLogistics — `/delivery-route`

Tabs **Route** (`?tab=route`) and **Areas** (`?tab=areas`).

- **Route** — today's ordered stops from `/milkman/delivery-route` (and `/zones/delivery-route/today`)
  with name, address, phone, quantity.
- **Areas** — CRUD over `milkman_delivery_areas` plus a toggle, via `/milkman/delivery-areas`.

## 7.9 CombinedPlans — `/subscription-plans`

Tabs **Customer plans** (`?tab=customer-plans`) and **Membership** (`?tab=membership`).

- **Customer plans** — CRUD over the milkman's `subscription_plans`: name, product, quantity,
  unit, frequency, delivery time, `price_per_delivery`, `monthly_price`, active flag.
- **Membership** — the milkman's own SaaS subscription: current plan, days remaining, customer
  count vs limit, upgrade, and the UTR payment form.

## 7.10 PlanChangeRequests — `/plan-change-requests`

The request inbox, badged in the bottom bar and sidebar. Each card shows **current vs requested**
side by side (name, quantity, unit, monthly price) plus the customer's reason.

- Approve → `PATCH /milkman/plan-change-requests/:id/approve`, optionally with `adjustedDetails`
  to override quantity, delivery time, price, etc. before applying.
- Reject → `PATCH /milkman/plan-change-requests/:id/reject` with notes.

## 7.11 Earnings — `/earnings`

`GET /milkman/earnings?range=&month=`.

Today / week / month / all-time **earned**, and the same for **collected**, with `pendingDues`
as the gap. Split by `subscriptionRevenue` vs `productPurchases`. Top 5 products by revenue.
A merged transaction feed (deliveries, purchases, payments — `is_payment` distinguishes them),
capped at 60.

> ⚠️ These figures use `/30` and a ₹75 fallback, while customer bills use the true month length
> and the plan price. **The milkman's revenue will not equal the sum of their customers' bills.**
> See [04](04-business-logic.md#415-constant-reference).

## 7.12 Profile and Settings

**Profile** — name, phone, business name, business address, **UPI ID and QR code URL** (what
customers pay to), and service areas. `POST /milkman/profile`.

**Settings** — language, notification settings (`NotificationSettings`, `usePushNotifications`),
PWA install, logout.

## 7.13 Shared concerns

Same auth store, axios client, i18n context and Tailwind theme as the customer app — but as
**diverged copies**, not a shared package (`api.ts`, `authStore.ts`, `CowLoader`,
`NotificationBell`, `PWAInstallBanner` all differ across the three apps). The milkman's
`NotificationBell` is the most evolved: 8-second poll, new-notification detection, sound.

Locale files hold ~256 keys each (vs the customer's ~350), with the same heavy use of inline
`language === 'hi'` ternaries instead of `t()`.

`usePushNotifications` + `utils/push-notifications.ts` implement subscribe/unsubscribe against
`/push-notifications/*`. **Non-functional** — VAPID unset, `push_subscriptions` missing, and
`/unsubscribe` isn't implemented server-side.

Same dual-Vite-config problem as the customer app: `vite.config.js` shadows `vite.config.ts`.

## 7.14 Dead pages — 21 of 34

The largest cleanup opportunity in the repo. All unreachable from `App.tsx`.

| File | Superseded by |
|---|---|
| `Milkman/Deliveries.tsx` | `CombinedDeliveriesProducts` |
| `Milkman/DailyProducts.tsx` | ″ catalog tab |
| `Milkman/ProductPurchases.tsx` | ″ orders tab |
| `Milkman/QuantityRequests.tsx` | ″ quantity tab |
| `Milkman/DeliveryHistory.tsx` | ″ orders/history |
| `Milkman/CombinedProducts.tsx` | ″ (an intermediate refactor) |
| `Milkman/Customers.tsx` | `CombinedCustomers` |
| `Milkman/PendingCustomers.tsx` | ″ pending tab |
| `Milkman/Approvals.tsx` | ″ (calls endpoints that never existed) |
| `Milkman/DeliveryRoute.tsx` | `CombinedLogistics` |
| `Milkman/DeliveryAreas.tsx` | ″ areas tab |
| `Milkman/SubscriptionPlans.tsx` | `CombinedPlans` |
| `Milkman/Subscriptions.tsx` | ″ |
| `Milkman/CreateSubscription.tsx` | `CustomerDetail` |
| `Milkman/ProductManagement.tsx` | calls the non-existent `/milkman/products` |
| `Auth/Login.tsx`, `Auth/CustomerLogin.tsx`, `Auth/MilkmanRegister.tsx` | `MilkmanLogin` |
| `LandingPage.tsx` | never routed |
| `pages/customer/Dashboard.tsx`, `pages/customer/Subscriptions.tsx` | wrong app entirely |

Plus `src/App.jsx`, `src/main.jsx`, and the stock `README.md`.

**~8,000 lines of dead page code.** Do not port any of it.
