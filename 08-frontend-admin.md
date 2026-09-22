# 8. Admin Console

`client-admin` · dev port **5175** · installable PWA · **English only**.

Internal back-office for the platform operator. A handful of users on desktop. The cleanest of
the three apps — **zero dead pages**, and the only one whose Vite config isn't shadowed.

Its job is narrow and high-stakes: decide who may trade on the platform, and confirm who has
paid for it.

## 8.1 Shell

```
GoogleOAuthProvider
└── BrowserRouter
    ├── PWAInstallBanner
    ├── Toaster                    top-right, 12px radius (vs pills in the other apps)
    └── Routes
        ├── /login        AdminLogin                (public)
        └── /             ProtectedRoute → MainLayout
            ├── index             Dashboard
            ├── /milkmen          Milkmen
            ├── /milkmen/:id      MilkmanDetail
            ├── /platform-plans   PlatformPlans
            ├── /subscriptions    AdminSubscriptions
            ├── /payments         Payments
            ├── /analytics        Analytics
            └── /settings         Settings
```

**Separate localStorage keys:** `admin_token` and `admin_user`, *not* `token`/`user`. This lets
an operator stay signed into the admin console and a test customer account in the same browser
without collision. Keep this.

### ProtectedRoute

On mount, then every **5 minutes**: rehydrate from `admin_token`/`admin_user`; require
`role === 'admin'`; `GET /auth/verify-status` and require `valid && role === 'admin'`;
otherwise `logout()` and redirect to `/login`.

Stricter than the other two apps — it logs out on any verification failure, not just 401.
Correct for a privileged console.

### MainLayout

Persistent desktop sidebar + header. Navigation:

| Label | Route |
|---|---|
| Dashboard | `/` |
| Milkmen Partners | `/milkmen` |
| Platform Plans | `/platform-plans` |
| Sub Verifications | `/subscriptions` |
| Payments & Ledger | `/payments` |
| Analytics & Growth | `/analytics` |
| Payment QR / Settings | `/settings` |

## 8.2 AdminLogin — `/login`

Google only — email/password login was deliberately removed (commit `9f85d88`).

```
POST /auth/google-login { credential, role: 'admin' }
```

Server-side, the email must be in `ADMIN_EMAILS` **or** the `admins` table; otherwise 403
*"Access denied. Your email is not authorized for admin access."* On success the `users` row is
created or upgraded to `role='admin'`.

> ⚠️ `App.tsx` falls back to a hardcoded client ID from a **different Google project** if
> `VITE_GOOGLE_CLIENT_ID` is missing. Remove the fallback — fail loudly on missing config.

## 8.3 Dashboard — `/`

`GET /admin/stats`.

**KPI tiles:** total milkmen · active milkmen (with an active subscription) · pending milkmen
(unverified) · total customers · monthly revenue · today's revenue · active subscriptions ·
pending payments.

**Recent activity** — a merged, date-sorted feed of the latest 3 platform payments, 3 milkman
signups and 3 customer signups (customers annotated with their assigned milkman's name and
business name), capped at 6.

> ⚠️ The API returns a `badgeColor` field containing a **Tailwind class string**
> (`"bg-emerald-100 text-emerald-800"`). Presentation must not come from the API. Return a
> semantic `severity: 'success' | 'warning' | 'error'` and map it client-side.

## 8.4 Milkmen — `/milkmen`

`GET /admin/milkmen` — every milkman with profile and subscription state.

Columns: name, email, phone, business name, verification status, subscription status, plan,
customer count, joined date. Filter by verified/unverified/active/expired; search by name,
email or business.

Actions: **Verify** (`POST /admin/milkmen/:id/verify`) and **Suspend**
(`POST /admin/milkmen/:id/suspend`).

**Suspension is destructive:** it sets `is_verified=false` **and cancels the milkman's
active/trial subscription**, which instantly locks them and all their customers out of
operations. It requires a confirmation dialog stating that consequence plainly. There is no
un-suspend — verifying again does not restore the cancelled subscription.

## 8.5 MilkmanDetail — `/milkmen/:id`

`GET /admin/milkmen/:id`. Full profile, business details, UPI/QR, service areas, subscription
history, payment history, customer count. Verify/suspend from here too.

## 8.6 PlatformPlans — `/platform-plans`

CRUD over `platform_subscription_plans`:

| Field | Notes |
|---|---|
| `name`, `description` | |
| `monthly_price` | ₹ |
| **`max_customers`** | the enforced ceiling — the product's core monetisation lever |
| `trial_customer_limit` | default 5 |
| `features` | list of strings shown on the plan card |
| `is_active` | hides it from selection without deleting |

`POST` / `PUT /admin/platform-plans/:id` / `DELETE /admin/platform-plans/:id`.

If the table is empty, the public plans endpoint seeds Starter ₹499/25, Growth ₹999/75,
Enterprise ₹1499/200.

> Changing `max_customers` on a plan retroactively changes the ceiling for every milkman on it.
> A milkman already above a lowered ceiling isn't downgraded — they simply can't approve anyone
> new. Worth surfacing in the UI.

## 8.7 AdminSubscriptions — `/subscriptions`

**The most important screen in this app.** It is the manual gate on all platform revenue.

`GET /admin/subscriptions/pending-verifications` — `milkman_subscriptions` with
`status='pending'`, joined to the milkman and the plan.

Each row: milkman name/email/phone, plan, amount, **the submitted UTR** (`payment_ref`),
submission time.

```
POST /admin/subscriptions/:subscriptionId/verify { action: 'approve' }
  → status='active', payment_status='paid', start=now, end=now+30d
  → INSERT platform_payments { amount, 'upi', transaction_id: payment_ref, 'success' }
  → notify milkman

POST /admin/subscriptions/:subscriptionId/verify { action: 'reject', rejectReason }
  → status='cancelled', payment_status='rejected', notes=rejectReason
  → INSERT platform_payments { …, 'failed' }
  → notify milkman
```

The operator must check the UTR against their bank statement before approving. There is no
automated reconciliation.

> Approval **resets** `end_date` to `now + 30 days`, discarding any remaining days on an early
> renewal. Decide deliberately whether to extend from the existing `end_date` instead.

## 8.8 Payments — `/payments`

`GET /admin/payments` — the full `platform_payments` ledger: milkman, amount, method,
transaction id/UTR, status, paid-at. Filter by status and date; totals by period.

This is SaaS revenue only. Customer↔milkman money never appears here.

## 8.9 Analytics — `/analytics`

`GET /admin/analytics`. Revenue over time, payment success/failure, plan distribution,
milkman growth, and regional density derived from `milkman_profiles.service_areas` and
customer addresses.

> ⚠️ **Plan distribution is permanently broken.** The handler queries `platform_plans`, a table
> that does not exist (the real one is `platform_subscription_plans`), so the name map is empty
> and **every subscription is labelled "7-Day Free Trial"**. One-word fix, but it makes the chart
> actively misleading today. See [09-known-defects.md](09-known-defects.md#schema-drift).

## 8.10 Settings — `/settings`

`GET` / `POST /admin/platform-settings` — the single-row config that milkmen pay into:

| Field | Purpose |
|---|---|
| `platform_qr_code_url` | QR shown to milkmen on the plan screen |
| `platform_upi_id` | defaults to `dairydrop@upi` if unset |
| `bank_details` | free text |
| `support_phone` | shown to milkmen |

Changing these changes where every milkman sends money. Treat as a privileged action —
confirm, and ideally audit-log it.

## 8.11 Differences from the other two apps

| | Customer / Milkman | Admin |
|---|---|---|
| Languages | en / hi / gu | **English only** |
| Storage keys | `token` / `user` | `admin_token` / `admin_user` |
| Toast position | top-center, pill | top-right, 12px radius |
| Splash animation | yes | no |
| Dead pages | 6 / 21 | **0** |
| Vite config | `.js` shadows `.ts` | **`.ts` only — correct** |
| Logout on verify failure | 401 only | any failure |
| Layout | mobile-first + bottom nav | desktop sidebar |

Shared UI components (`CowLoader`, `NotificationBell`, `PWAInstallBanner`, `InstallAppButton`,
`MainLayout`, `Header`, `Sidebar`) are again **diverged copies**, not a shared package.

## 8.12 What the admin app is missing

Gaps worth closing in the rebuild:

- **No customer-level view.** An admin cannot see or help an individual end customer, which
  makes support escalations impossible.
- **No audit log.** Verifications, suspensions and settings changes leave no trace of who did
  what, when.
- **No un-suspend.** Suspension cancels the subscription irreversibly through the UI.
- **No refunds or manual adjustments.**
- **No impersonation / "view as"** for debugging a milkman's account.
- **No export.** Every list is on-screen only — no CSV for accounting.
- **No i18n**, though the operators are the same market as the other two apps.
