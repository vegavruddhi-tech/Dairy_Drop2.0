# 2. Data Model

Corrected schema. This supersedes `FULL_DATABASE_SCHEMA.sql`, which is missing 4 tables,
1 stored procedure and at least 10 columns the running code depends on.

Types below are PostgreSQL. `ts` = `TIMESTAMPTZ`, `num(10,2)` = `NUMERIC(10,2)`.
Everything uses UUID primary keys (`gen_random_uuid()`) except `platform_settings`.

## Entity relationship overview

```
                         ┌──────────────┐
                         │    users     │ role: customer | milkman | admin
                         │              │ self-ref: milkman_id → users.id
                         └──────┬───────┘
          ┌─────────────────────┼─────────────────────────┐
          │                     │                         │
   (role=customer)       (role=milkman)             (role=admin)
          │                     │
          ▼                     ▼
   ┌─────────────┐      ┌───────────────────┐    ┌──────────────────────────┐
   │  addresses  │      │ milkman_profiles  │    │ platform_subscription_   │
   └─────────────┘      │ (1:1, is_verified)│    │ plans  (SaaS catalog)    │
                        └─────────┬─────────┘    └────────────┬─────────────┘
                                  │                           │
                ┌─────────────────┼───────────────┐           │
                ▼                 ▼               ▼           ▼
       ┌────────────────┐ ┌──────────────┐ ┌──────────────────────────┐
       │subscription_   │ │daily_products│ │ milkman_subscriptions    │
       │plans (milk     │ │(extra goods) │ │ (SaaS enrolment)         │
       │ catalog)       │ └──────┬───────┘ └────────────┬─────────────┘
       └───────┬────────┘        │                      ▼
               │                 │             ┌──────────────────┐
               ▼                 ▼             │ platform_payments│
       ┌───────────────┐  ┌──────────────────┐ └──────────────────┘
       │ subscriptions │  │ product_purchases│
       │ (customer     │  └────────┬─────────┘
       │  enrolment)   │           │
       └───────┬───────┘           │
               │                   │
               ▼                   │
       ┌───────────────┐           │
       │  deliveries   │◄──────────┘  both roll up into
       │ (billing atom)│              monthly_bills
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐      ┌──────────┐
       │ monthly_bills │◄─────│ payments │
       └───────────────┘      └──────────┘
```

---

## 2.1 Identity

### `users`

The single identity table for all three roles. Self-referential: a customer's `milkman_id`
points at their milkman's row.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `email` | text NOT NULL UNIQUE | always stored lowercased |
| `password` | text NOT NULL | bcrypt. **Unused in practice** — all logins are Google OAuth. Google users get a random 32-byte hash. |
| `phone` | text NOT NULL | 10 digits, no country code |
| `role` | text | `customer` \| `milkman` \| `admin`, default `customer` |
| `address` | jsonb | legacy; real addresses live in `addresses` |
| `zone_id` | uuid | legacy, unused |
| `is_active` | bool | default true, never written |
| `profile_completed` | bool | default false, never read |
| `assigned_milkman_id` | uuid → users.id | **duplicate of `milkman_id`** — drop one on rebuild |
| `milkman_id` | uuid → users.id | the tenant key for customers |
| `sector`, `city` | text | legacy |
| `google_id` | text UNIQUE | Google `sub` claim |
| `profile_picture` | text | Google avatar URL |
| `is_approved` | bool | default false — customer approval gate |
| `approval_status` | varchar(20) | `pending` \| `approved` \| `rejected` |
| `approved_by` | uuid → users.id | |
| `approved_at` | ts | |
| `delivery_area` | varchar(100) | area/sector name chosen at signup |
| **`rejection_reason`** | **text** | **MISSING FROM SQL FILE** — written by reject-customer |
| `created_at`, `updated_at` | ts | |

> `dairy_name` is selected in 4 places in `auth.routes.ts` but does not exist on this table.
> Those selects silently return nothing. On rebuild, business name lives on
> `milkman_profiles.business_name` — use that.

**Indexes:** `email`, `role`, `milkman_id`, and add `(milkman_id, role, is_approved)` — that
composite is hit on every customer-limit check and every customer listing.

### `admins`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | varchar(255) UNIQUE NOT NULL | |
| `full_name` | varchar(255) | |
| `created_at`, `updated_at` | ts | |

A secondary admin allowlist, checked in addition to the `ADMIN_EMAILS` env var. An email in
either source may sign in as admin. A `users` row with `role='admin'` is auto-created on first
admin login.

### `milkman_profiles`

1:1 with a milkman `users` row. **This is the tenant record.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `milkman_id` | uuid UNIQUE NOT NULL → users.id | |
| `business_name` | varchar(255) NOT NULL | shown to customers |
| `business_address` | text | |
| `gst_number`, `pan_number` | varchar(50) | collected, never validated or used |
| `service_areas` | jsonb, default `[]` | array of strings **or** `{name, area, sector, pincode}` objects — see note below |
| `logo_url` | text | |
| `is_verified` | bool default false | **admin-controlled panel access gate** |
| `upi_id` | text | customer pays here |
| `qr_code_url` | text | customer scans this |
| `created_at`, `updated_at` | ts | |

> **`service_areas` is polymorphic.** Serviceability matching has to handle both a bare string
> and an object with any of four key names, and does substring matching in both directions.
> On rebuild, normalise this into a proper `milkman_service_areas` table with
> `(milkman_id, area_name, pincode)` and exact matching.

---

## 2.2 Geography

### `zones`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text UNIQUE NOT NULL | slug |
| `display_name` | text NOT NULL | shown in UI |
| `pincodes` | text[] NOT NULL default `{}` | |
| `city` | text NOT NULL | |
| `is_active` | bool default true | |
| `milkman_id` | uuid → users.id | direct owner (alternative to `milkman_zones`) |
| `created_at` | ts | |

### `milkman_zones`

Many-to-many between milkmen and zones. **Redundant with `zones.milkman_id`** — the code checks
both. Pick one on rebuild; the m2m table is the better model.

`id`, `milkman_id`, `zone_id`, `is_active`, `created_at`.

### `milkman_delivery_areas`

A third, free-text way to express coverage: `id`, `milkman_id`, `name`, `description`, timestamps.

> **Three overlapping coverage models exist** (`milkman_profiles.service_areas`, `zones`
> +`milkman_zones`, `milkman_delivery_areas`). Serviceability checks fall through all of them
> in sequence. Collapse to one on rebuild.

### `addresses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL → users.id ON DELETE CASCADE | |
| `name`, `phone` | varchar | recipient override |
| `street` | text NOT NULL | |
| `area` | text NOT NULL | |
| `city` | text NOT NULL | |
| `state` | text NOT NULL default `'State'` | |
| `pincode` | text NOT NULL | |
| `landmark` | text | |
| `address_line1` | varchar(255) default `''` | **duplicate of `street`** |
| `address_line2` | varchar(255) | **duplicate of `landmark`** |
| `postal_code` | varchar(20) default `''` | **duplicate of `pincode`** |
| `is_default` | bool default false | |
| `is_primary` | bool default false | **duplicate of `is_default`**, never written |
| `delivery_instructions` | text | |
| `latitude`, `longitude` | num(10,7) | collected, never used |
| `created_at`, `updated_at` | ts | |

> Four pairs of duplicate columns. Writes populate both halves of each pair; reads use
> `street || address_line1` style fallbacks everywhere. Collapse on rebuild.

---

## 2.3 SaaS layer (platform → milkman)

### `platform_subscription_plans`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(100) NOT NULL | |
| `description` | text | |
| `monthly_price` | num(10,2) NOT NULL | |
| `max_customers` | integer NOT NULL | **the enforced limit** |
| `trial_customer_limit` | integer default 5 | |
| `features` | jsonb default `{}` | actually written as a JSON **array** of strings |
| `is_active` | bool default true | |
| `created_at`, `updated_at` | ts | |

If this table is empty, the API seeds three defaults on first read:

| Name | Price/mo | Max customers |
|---|---|---|
| Starter Plan | ₹499 | 25 |
| Growth Plan | ₹999 | 75 |
| Enterprise Plan | ₹1499 | 200 |

### `milkman_subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `milkman_id` | uuid NOT NULL → users.id | |
| `plan_id` | uuid → platform_subscription_plans.id | **NULL means this is a trial** |
| `start_date` | date NOT NULL | written as a full ISO timestamp in practice |
| `end_date` | date NOT NULL | ditto |
| `status` | varchar(20) | see state machine below |
| `payment_status` | varchar(20) | `pending` \| `paid` \| `failed` \| `rejected` |
| `auto_renew` | bool default true | never acted on — nothing auto-renews |
| `trial_customer_limit` | integer default 5 | |
| `payment_ref` | varchar(255) | the UTR the milkman submits |
| **`notes`** | **text** | **MISSING FROM SQL FILE** — written on admin rejection |
| `created_at`, `updated_at` | ts | |

**`status` values actually used by the code** — the SQL `CHECK` constraint is incomplete:

| Value | In SQL CHECK? | Meaning |
|---|---|---|
| `trial` | yes | 7-day free trial, `plan_id IS NULL` |
| `active` | yes | paid and verified |
| `pending` | yes | UTR submitted, awaiting admin |
| `expired` | yes | past `end_date` |
| `cancelled` | yes | cancelled by milkman or admin suspension |
| **`pending_payment`** | **NO — violates the constraint** | written by `POST /milkman/subscription/initiate` |
| **`pending_verification`** | **NO** | only ever read, never written |
| **`rejected`** (payment_status) | **NO** | written by admin reject |

> `POST /milkman/subscription/initiate` inserts `status='pending_payment'`, which the CHECK
> constraint rejects. That endpoint is dead on arrival. See [09-known-defects.md](09-known-defects.md).

**State machine:**

```
                 ┌──────── free-trial ────────┐
                 ▼                            │
   (none) ──► trial ──(7 days)──► expired ────┤
                 │                            │
                 └──► [submit UTR] ──► pending ──► admin approve ──► active
                                          │                            │
                                          └── admin reject ──► cancelled
                                                                       │
                                            active ──(end_date)──► expired
                                            active ──(suspend)──► cancelled
```

### `platform_payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `milkman_id` | uuid NOT NULL → users.id | |
| `subscription_id` | uuid → milkman_subscriptions.id | |
| `amount` | num(10,2) NOT NULL | |
| `payment_method` | varchar(50) | always `'upi'` |
| `transaction_id` | varchar(255) | the UTR |
| `status` | varchar(20) | `pending` \| `success` \| `failed` \| `refunded` |
| `paid_at` | ts | |
| **`utr_number`** | **varchar(255)** | **MISSING FROM SQL FILE** — read by admin dashboard activity feed |
| `created_at` | ts | |

> `utr_number` and `transaction_id` are the same thing under two names. Keep one.

### `platform_settings`

Single-row config table. `id SERIAL PK`, `platform_qr_code_url`, `platform_upi_id`,
`bank_details`, `support_phone`, `updated_at`. This is where milkmen send their SaaS payment.

---

## 2.4 Operational layer (milkman → customer)

### `subscription_plans`

The milk packages a milkman offers.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `milkman_id` | uuid → users.id | tenant key |
| `created_by` | uuid → users.id | |
| `name` | varchar(100) NOT NULL | |
| `description` | text | |
| `product_id` | uuid | dangling — no FK, rarely set |
| `product_name` | varchar(100) NOT NULL | |
| `quantity` | num(10,2) NOT NULL default 1 | litres per delivery |
| `unit` | varchar(20) NOT NULL default `'litre'` | |
| `frequency` | varchar(30) | `daily` \| `alternate_days` \| `weekly` \| `monthly` — **stored but never honoured** |
| `delivery_time` | varchar(20) | `morning` \| `evening` \| `both` |
| `price_per_delivery` | num(10,2) NOT NULL | **takes precedence in billing when > 0** |
| `monthly_price` | num(10,2) NOT NULL | |
| `is_active` | bool default true | |
| `created_at`, `updated_at` | ts | |

### `subscriptions`

A customer's enrolment. A customer may hold **several at once** (multi-plan).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid NOT NULL → users.id | |
| `milkman_id` | uuid → users.id | denormalised tenant key |
| `plan_id` | uuid → subscription_plans.id | |
| `product_id` | uuid | dangling |
| `product_name` | text NOT NULL | snapshot at subscribe time |
| `quantity` | num(10,2) NOT NULL default 1 | the **standard daily quantity** |
| `unit` | text default `'L'` | |
| `frequency` | text NOT NULL default `'daily'` | not honoured |
| `delivery_time` | text | `morning` \| `evening` \| `both` |
| `start_date` | date NOT NULL | |
| `end_date` | date | set on cancel |
| `monthly_price` | num(10,2) NOT NULL | snapshot |
| `status` | varchar(20) | `active` \| `paused` \| `cancelled` \| `pending` (+ `rejected`, written on customer rejection but **not in the CHECK constraint**) |
| `is_active` | bool default true | **redundant with `status`** — both are written, reads use `is_active OR status='active'` |
| **`paused_until`** | **date** | **MISSING FROM SQL FILE** — cleared on resume |
| `created_at`, `updated_at` | ts | |

> Keep `status` only. `is_active` doubles every state transition and is a constant source of
> drift between the two fields.

### `deliveries` — the billing atom

One row per customer per subscription per day. **This is the most important table.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid NOT NULL → users.id | |
| `milkman_id` | uuid → users.id | |
| `subscription_id` | uuid → subscriptions.id | |
| `product_name` | text NOT NULL | |
| `quantity` | num(10,2) NOT NULL, CHECK 0–100 | the **planned** quantity |
| `delivery_date` | date NOT NULL | business date, IST |
| `delivery_time` | text default `'morning'` | |
| `status` | text | `pending` \| `delivered` \| `undelivered` \| `skipped` \| `cancelled` |
| `delivered_at` | ts | |
| `reason` | text | unused |
| `notes` | text | written by customer skip/resume |
| `delivery_notes` | text | written by milkman |
| **`quantity_delivered`** | **num(10,2)** | **MISSING FROM SQL FILE** — 9 code refs |
| **`total_amount`** | **num(10,2)** | **MISSING FROM SQL FILE** — 39 code refs |
| **`price_per_unit`** | **num(10,2)** | **MISSING FROM SQL FILE** — 23 code refs |
| `created_at`, `updated_at` | ts | |

> ⚠️ **The three missing columns break delivery marking.** `POST /milkman/deliveries/update-status`
> writes all three. Against a database built purely from `FULL_DATABASE_SCHEMA.sql`, PostgREST
> rejects the update and no delivery can ever be marked delivered. The live database must have
> had them added by hand. **Include them in the rebuild schema.**

> `notes` vs `delivery_notes` vs `reason` — three free-text fields for the same purpose, written
> by different endpoints and read inconsistently. Collapse to one.

**Status semantics:**

| Status | `quantity_delivered` | `total_amount` | `delivered_at` | Billed? |
|---|---|---|---|---|
| `pending` | NULL | 0 | NULL | no |
| `delivered` | actual qty | qty × price_per_unit | now | **yes** |
| `undelivered` | 0 | 0 | NULL | no |
| `skipped` | 0 | 0 | NULL | no |
| `cancelled` | — | — | — | no |

`undelivered` = milkman came but couldn't deliver (customer absent). `skipped` = planned
non-delivery (customer skipped, or milkman day off). Both bill ₹0; they differ only in reporting.

### `delivery_routes`

Denormalised round sheet: `milkman_id`, `customer_id`, `zone_id`, `zone_name`, `customer_name`,
`customer_address`, `customer_phone`, `delivery_date`, `route_sequence`, `status`,
`delivered_at`, `notes`, `latitude`, `longitude`.

Largely vestigial — the milkman round view is built live from `deliveries` + `subscriptions`.
Drop it unless you build real route optimisation.

---

## 2.5 Extra products

### `daily_products`

The milkman's catalog of non-milk goods.

`id`, `milkman_id`, `name`, `description`, `available_quantity num(10,2)`, `unit varchar(50)`,
`price_per_unit num(10,2)`, `image_url`, `is_available bool`, `added_date date`, timestamps.

Nine stock product images ship with the apps: cow_milk, buffalo_milk, paneer, ghee, butter,
dahi, chaas, cream, mawa — matched to `name` by substring in the frontend.

### `product_purchases`

A customer's order against `daily_products`. **This is the table that actually drives extra-product
billing.**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `product_id` | uuid → daily_products.id | |
| `customer_id` | uuid → users.id | |
| `milkman_id` | uuid → users.id | |
| `quantity` | num(10,2) NOT NULL | |
| `price_per_unit` | num(10,2) NOT NULL | snapshot |
| `total_amount` | num(10,2) NOT NULL | `quantity × price_per_unit`, rounded to 2dp |
| `customer_address` | text | flattened snapshot |
| `purchase_date` | ts default now() | |
| `status` | varchar(20) | `pending` \| `accepted` \| `completed` \| `delivered` \| `cancelled` |
| `delivered_at` | ts | |
| `created_at`, `updated_at` | ts | |

> Billing filters this table on **`created_at`**, but every listing and the milkman earnings
> calculation filter on **`purchase_date`**. They can diverge. Pick one on rebuild —
> `purchase_date` is the meaningful one.

### `daily_product_orders` and `additional_orders`

Two further order tables that are **dead**. `daily_product_orders` is read by exactly one
endpoint (customer delivery history) and never written. `additional_orders` is read by one
milkman endpoint and never written; its write endpoints were deleted (there's a comment saying
so in `customer.routes.ts`). The live path is `product_purchases`.

**Drop both on rebuild.**

### `milkman_products`

Defined in SQL, **never queried by any code**. Drop it.

---

## 2.6 Change requests

### `quantity_change_requests`

A one-day quantity adjustment.

`id`, `customer_id`, `milkman_id`, `delivery_date date`, `current_quantity`, `requested_quantity`,
`status` (`pending`|`accepted`|`rejected`|`completed`), `request_notes`, `response_notes`,
`responded_at`, timestamps.

> **`subscription_id` is missing from the SQL file but is written and read by the code.** Without
> it, a multi-plan customer's quantity request is ambiguous. Add it.

Two entry points create rows here with **different semantics**:

| Endpoint | Initial status | Effect |
|---|---|---|
| `POST /customer/deliveries/change-quantity` | `accepted` | delivery quantity changed **immediately**, no approval |
| `POST /customer/quantity-change-request` | `pending` | waits for the milkman |

Decide which you want. The auto-accept path is what the live customer UI uses.

### `plan_change_requests`

A permanent plan switch. Fully snapshots both sides so the milkman sees a before/after.

`id`, `customer_id`, `milkman_id`, `subscription_id`, `current_plan_id`, `requested_plan_id`,
`current_plan_name`, `current_quantity`, `current_unit`, `current_monthly_price`,
`requested_plan_name`, `requested_quantity`, `requested_unit`, `requested_monthly_price`,
`status`, `request_notes`, `response_notes`, `responded_at`, `approved_at`, `rejected_at`, timestamps.

`status ∈ {pending, accepted, approved, rejected}` — note **both `accepted` and `approved`**
are permitted, and different endpoints write different ones. Standardise on one.

**Partial unique index enforces one pending request per customer:**
```sql
CREATE UNIQUE INDEX plan_change_requests_one_pending_idx
  ON plan_change_requests(customer_id) WHERE status = 'pending';
```
The application separately enforces one pending per *subscription*, which is a weaker rule than
the index. The index wins, so a multi-plan customer can only have one outstanding plan change
across all their plans.

---

## 2.7 Billing and payments

### `monthly_bills`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid NOT NULL → users.id | |
| `milkman_id` | uuid → users.id | |
| `month` | text NOT NULL | `'YYYY-MM'` |
| `subscription_amount` | num(10,2) default 0 | milk portion |
| `additional_amount` | num(10,2) default 0 | products portion |
| `total_amount` | num(10,2) NOT NULL | |
| `paid_amount` | num(10,2) default 0 | |
| `payment_status` | text | `pending` \| `paid` \| `partially_paid` \| `overdue` |
| `due_date` | date NOT NULL | last day of the month |
| `paid_at` | ts | |
| `payment_method` | text | |
| `notes` | text | |
| `created_at`, `updated_at` | ts | |

> No unique constraint on `(customer_id, month)` — but every read uses `.maybeSingle()`, which
> **throws if two rows exist**. Add `UNIQUE (customer_id, month)`.

> Rows are only created lazily when a payment is submitted. There is no month-end billing job.
> The customer's live bill is computed on the fly by the billing-breakdown endpoint
> ([04-business-logic.md](04-business-logic.md#42-customer-monthly-bill)). `monthly_bills` is
> effectively a payment ledger, not a bill register.

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `customer_id` | uuid NOT NULL → users.id | |
| `bill_id` | uuid → monthly_bills.id | |
| `razorpay_order_id` | varchar(255) UNIQUE | |
| `razorpay_payment_id` | varchar(255) UNIQUE | **abused** — offline payments store `UTR-<utr>` or `PAYTM-<timestamp>` here |
| `razorpay_signature` | text | |
| `amount` | num(10,2) NOT NULL | |
| `currency` | varchar(10) default `'INR'` | |
| `payment_method` | varchar(50) | |
| `status` | varchar(20) | see below |
| `paid_at` | ts | |
| `failure_reason` | text | **abused** — offline flow stores the customer's note here |
| `created_at`, `updated_at` | ts | |

**`status` — the CHECK constraint and the code disagree:**

| Value | In CHECK? | Written by | Treated as paid? |
|---|---|---|---|
| `initiated` | yes | offline submit | no |
| `success` | yes | milkman verify, Razorpay verify | **yes** |
| `captured` | yes | — | **yes** |
| `failed` | yes | milkman reject | no |
| `refunded` | yes | — | no |
| **`completed`** | **NO** | never written | **yes** (read as paid in 5 places) |
| **`pending_verification`** | **NO** | never written | read as pending |
| **`pending`** | **NO** | never written | read as pending |

The "verified payment" predicate used throughout is:
```js
status IN ('completed', 'success', 'captured')
```
Only `success` and `captured` can actually occur. On rebuild, use a clean enum:
`pending | verified | rejected | refunded`.

---

## 2.8 Notifications

### `notifications`

`id`, `user_id` (→ users.id, any role), `title`, `message`, `type`, `related_id`,
`is_read bool`, `created_at`.

`type` is free text. Values in use: `customer_request`, `order_approved`, `order_rejected`,
`order_pending`, `order_delivered`, `delivery`, `delivery_delivered`, `payment`,
`product_available`, `announcement`, `plan_change_request`, `plan_change_approved`,
`plan_change_rejected`, `approval_status`, `quantity_request`, `general`.

**Emoji are stripped from title and message on write** by a Unicode-range regex — but three
call sites insert into this table directly, bypassing the helper, so some rows do contain emoji.

**Retention: 30 hours.** Every notification read triggers a fire-and-forget hard `DELETE` of
rows older than 30 hours, in both notification tables. Reads are additionally filtered to the
last 30 hours. This is aggressive and unusual — decide deliberately whether to keep it.

### `milkman_notifications`

A parallel table (`milkman_id`, `type`, `title`, `message`, `is_read`, `read_at`, `created_at`).
**Never written, never read** — only purged. Drop it; `notifications` handles all roles.

### `push_subscriptions` — MISSING ENTIRELY FROM THE SQL FILE

Required by `push-notification.service.ts`:

```sql
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_type   text NOT NULL CHECK (user_type IN ('milkman','customer','admin')),
  subscription jsonb NOT NULL,          -- the browser PushSubscription object
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, user_type)           -- required: code upserts on this pair
);
```
Rows are deleted automatically when the push endpoint returns HTTP 410 (expired).

---

## 2.9 Stored procedures

Two RPCs are called. Neither is in `FULL_DATABASE_SCHEMA.sql`.

| RPC | Called from | Required? |
|---|---|---|
| `resolve_plan_change_request(p_request_id, p_milkman_id, p_status, p_response_notes)` | `PUT /milkman/plan-change-requests/:id` | defined in `PLAN_CHANGE_REQUESTS.sql` |
| `get_zone_by_pincode(pincode_param)` | pincode serviceability check | **nowhere** — call is wrapped in try/catch and silently falls through |

On rebuild, do this in application code inside a transaction. There is no reason for a stored
procedure here, and having the plan-change logic exist in *both* a PL/pgSQL function and a
TypeScript handler (`PATCH .../approve`) means two divergent implementations of the same rule.

---

## 2.10 Tables referenced in code but never defined

These four are queried live and always fail or return empty:

| Table | Referenced at | What it should be |
|---|---|---|
| `customers` | `auth.routes.ts` ×4 | legacy — the data is on `users`. Delete the code. |
| `products` | `customer.routes.ts` ×3 | should be `daily_products`. **Breaks `POST /customer/subscribe-plan`.** |
| `platform_plans` | `admin.routes.ts:243` | should be `platform_subscription_plans`. Breaks admin plan analytics. |
| `push_subscriptions` | push service ×5 | genuinely missing — create it (above). |

---

## 2.11 Recommended index set for the rebuild

Derived from the actual query shapes:

```sql
-- identity / tenancy
CREATE INDEX ON users (email);
CREATE INDEX ON users (milkman_id, role, is_approved);   -- customer limit + listings
CREATE INDEX ON users (role);

-- the hot path: the daily round and the monthly bill
CREATE INDEX ON deliveries (milkman_id, delivery_date);
CREATE INDEX ON deliveries (customer_id, delivery_date);
CREATE INDEX ON deliveries (subscription_id, delivery_date);
CREATE UNIQUE INDEX ON deliveries (subscription_id, delivery_date);  -- prevents double-billing

-- subscriptions
CREATE INDEX ON subscriptions (customer_id, status);
CREATE INDEX ON subscriptions (milkman_id, status);

-- products & money
CREATE INDEX ON daily_products (milkman_id, is_available);
CREATE INDEX ON product_purchases (milkman_id, purchase_date DESC);
CREATE INDEX ON product_purchases (customer_id, purchase_date DESC);
CREATE INDEX ON payments (customer_id, status);
CREATE UNIQUE INDEX ON monthly_bills (customer_id, month);

-- requests & notifications
CREATE INDEX ON plan_change_requests (milkman_id, status);
CREATE INDEX ON quantity_change_requests (milkman_id, status);
CREATE INDEX ON notifications (user_id, is_read, created_at DESC);

-- SaaS layer
CREATE INDEX ON milkman_subscriptions (milkman_id, status, created_at DESC);
```

The unique index on `deliveries (subscription_id, delivery_date)` is the important new one — it
makes the idempotent "generate today's deliveries" job safe and structurally prevents the
double-billing that the current code's `.maybeSingle()` existence checks fail to prevent.

## 2.12 Row-level security

The current system has **zero RLS policies** and the backend connects with the Supabase
**service-role key**, which bypasses RLS entirely. All tenant isolation is application-level
`milkman_id` filtering in ~150 hand-written query builders.

This is the largest structural risk in the codebase: one forgotten `.eq('milkman_id', …)` is a
cross-tenant data leak, and there is no second line of defence. Several endpoints already rely
on it being got right every time.

On rebuild, either enforce tenancy in the database (RLS with a request-scoped tenant claim) or
in a single query layer that cannot be bypassed. See
[10-rebuild-guide.md](10-rebuild-guide.md#tenancy).
