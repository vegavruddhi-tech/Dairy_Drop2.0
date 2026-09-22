# 1. Product Overview

## What DairyDrop is

A **B2B2C SaaS platform for dairy delivery in India**. It has two nested business models:

1. **Platform → Milkman (the SaaS layer).** The platform operator sells monthly subscription
   plans to independent milk vendors ("milkmen"). Plans are tiered by how many customers the
   milkman may serve. Payment is collected offline via UPI; the milkman submits a UTR reference
   and an admin verifies it manually.

2. **Milkman → Customer (the operational layer).** Each milkman runs their own book of retail
   customers: daily milk subscriptions, an extra-products catalog, delivery tracking, and
   monthly billing. The milkman collects money from customers directly (UPI QR or cash).

The platform never touches customer money. It only charges the milkman a monthly SaaS fee.

```
┌──────────────────────────────────────────────────────────────┐
│  PLATFORM ADMIN                                              │
│  · sells platform plans (₹499 / ₹999 / ₹1499 per month)      │
│  · verifies milkman identity  (milkman_profiles.is_verified) │
│  · verifies milkman UTR payments → activates subscription    │
└───────────────────────┬──────────────────────────────────────┘
                        │ charges monthly SaaS fee
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  MILKMAN (tenant)                                            │
│  · 7-day free trial (max 5 customers), then a paid plan      │
│  · approves/rejects customer signups (bounded by plan limit) │
│  · defines subscription plans + a daily products catalog     │
│  · marks deliveries delivered / undelivered / skipped        │
│  · verifies customer payments, sees earnings                 │
└───────────────────────┬──────────────────────────────────────┘
                        │ delivers milk, bills monthly
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  CUSTOMER                                                    │
│  · picks a milkman at signup, waits for approval             │
│  · subscribes to a daily milk plan                           │
│  · skips days, changes quantity, requests plan changes       │
│  · buys extra products (paneer, ghee, curd…)                 │
│  · pays the monthly bill by UPI/cash                         │
└──────────────────────────────────────────────────────────────┘
```

## Actors

| Actor | Portal | Auth method | Tenancy |
|---|---|---|---|
| **Customer** | `client-customer` (port 5173) | Google OAuth only | scoped to one `milkman_id` |
| **Milkman** | `client-milkman` (port 5174) | Google OAuth only | is a tenant root |
| **Platform Admin** | `client-admin` (port 5175) | Google OAuth + email allowlist | global |

All three are installable PWAs. Mobile-first — the milkman uses this one-handed on a
motorbike round at 5am, which drives most of the UI decisions.

There is a fourth latent role in the data model (`users.role`), but only these three are used.

## Core domain objects

| Object | Meaning |
|---|---|
| **Platform plan** | A SaaS tier the platform sells to milkmen. Has `monthly_price` and `max_customers`. |
| **Milkman subscription** | A milkman's enrolment in a platform plan (or a trial). Drives panel access. |
| **Subscription plan** | A milk package a *milkman* offers customers (e.g. "1L Cow Milk, morning, ₹1800/mo"). |
| **Subscription** | A customer's active enrolment in one of their milkman's subscription plans. |
| **Delivery** | One row per customer per subscription per day. The billing atom. |
| **Daily product** | An extra item in the milkman's catalog (ghee, paneer, curd…) with stock. |
| **Product purchase** | A customer's one-off order of a daily product. Billed on top of milk. |
| **Monthly bill** | Aggregate of a customer's milk + products for a calendar month. |
| **Payment** | A customer's payment against a bill. Submitted by customer, verified by milkman. |
| **Platform payment** | A milkman's SaaS payment. Submitted by milkman, verified by admin. |

## The two subscription hierarchies — do not conflate them

This is the single most confusing part of the domain, and the old code's table names make it
worse. There are **two completely separate subscription systems**:

| | SaaS layer | Operational layer |
|---|---|---|
| Who pays | Milkman → Platform | Customer → Milkman |
| Catalog table | `platform_subscription_plans` | `subscription_plans` |
| Enrolment table | `milkman_subscriptions` | `subscriptions` |
| Payment table | `platform_payments` | `payments` |
| Verified by | Platform admin | Milkman |
| Billing cycle | fixed 30 days from activation | calendar month, usage-based |
| Failure mode | milkman loses panel access (HTTP 402) | customer accrues a balance |

**Rename these on rebuild.** Suggested: `saas_plans` / `saas_subscriptions` / `saas_payments`
versus `milk_plans` / `milk_subscriptions` / `customer_payments`.

## End-to-end lifecycle

### Milkman onboarding

1. Milkman signs in with Google on the milkman portal. A `users` row is created with
   `role='milkman'`.
2. A `milkman_profiles` row is created with `is_verified=false`. They enter business name,
   address, UPI ID, QR code URL, and service areas.
3. They start a **7-day free trial** — a `milkman_subscriptions` row with `plan_id=NULL`,
   `status='trial'`, `trial_customer_limit=5`.
4. Admin verifies their identity → `milkman_profiles.is_verified=true`.
5. Before the trial expires, the milkman picks a paid plan, pays by UPI to the platform's
   QR/UPI ID, and submits the **UTR reference**. Subscription goes to `status='pending'`.
6. Admin verifies the UTR → `status='active'`, `end_date = now + 30 days`, and a
   `platform_payments` row with `status='success'` is written.
7. Panel access requires **both** `is_verified=true` **and** an active/trial subscription.

### Customer onboarding

1. Customer opens the customer portal, enters a pincode. The system checks serviceability
   and lists milkmen covering that area.
2. Customer picks a milkman, fills in name/phone/address, and registers. A `users` row is
   created with `role='customer'`, `milkman_id=<chosen>`, `is_approved=false`,
   `approval_status='pending'`. An `addresses` row is created as default.
3. Registration is **rejected up-front** if the chosen milkman has no active subscription,
   or has hit their trial customer limit.
4. Customer sits on a "pending approval" screen, polling for status.
5. Milkman sees them under Pending Customers and approves. The platform re-checks the
   customer limit at this moment (see [04-business-logic.md](04-business-logic.md#customer-limit-enforcement)).
6. On approval: `is_approved=true`, `approval_status='approved'`, their subscription is
   activated, and today's delivery row is created.
7. Customer signs in with Google and lands on the dashboard.

### The daily operating cycle

```
  00:00 IST   Delivery rows for the day are generated from active subscriptions
              (one row per active subscription of every approved customer, status='pending')
     ↓
  before cutoff   Customer may: skip the day, change today's quantity,
                  or order extra products from the catalog
     ↓
  05:00 IST   Milkman opens the round view for today, sees every stop with
              customer name, address, phone, product, quantity, slot
     ↓
  on the round    Milkman marks each stop delivered / undelivered / skipped.
                  'delivered' freezes quantity_delivered and total_amount onto the row.
     ↓
  any time    Milkman may declare a bulk day off — all of today's rows → 'skipped', ₹0
     ↓
  month end   Customer's bill = Σ(delivered milk) + Σ(product purchases)
              Customer pays by UPI/cash and submits a UTR
              Milkman verifies → monthly_bills.paid_amount increases
```

### Request/approval flows

Three things a customer can ask their milkman for. All three follow
request → notification → milkman decision → notification:

| Request | Table | Effect when approved |
|---|---|---|
| **Quantity change** (one day) | `quantity_change_requests` | that day's delivery quantity changes |
| **Plan change** (permanent) | `plan_change_requests` | the subscription is rewritten with the new plan |
| **Registration** | `users.approval_status` | customer becomes active |

## Non-goals of the current product

Documented so you don't build them by accident — none of these exist:

- No delivery-person role. The milkman does their own round.
- No route optimisation. `delivery_routes` exists but is barely used; ordering is by insertion.
- No GPS tracking, no proof-of-delivery photo, no customer signature.
- No online card/netbanking payment. Razorpay is wired but **unconfigured and unused**;
  all real money moves offline via UPI/cash with manual verification.
- No refunds, no credit notes. Overpayment shows as `advanceCredit` but is never applied.
- No inventory/procurement. `daily_products.available_quantity` is a simple decrementing counter.
- No multi-language in the admin panel (customer and milkman have en/hi/gu).
- No email or SMS. All notification is in-app; web push is coded but **unconfigured**.
