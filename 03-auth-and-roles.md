# 3. Authentication, Roles and Access Control

## 3.1 Mechanism

**Google OAuth → server-verified ID token → app-issued JWT.**

Password login exists in the schema and one endpoint, but no portal uses it. Every real login
is Google. Google users get a cryptographically random bcrypt hash as their `password` so the
NOT NULL constraint is satisfied.

```
Browser                          API                         Google
   │                              │                             │
   │ ── GoogleLogin button ───────┼────────────────────────────►│
   │ ◄─────────── ID token (JWT, RS256, aud=CLIENT_ID) ─────────│
   │                              │                             │
   │ ── POST /auth/<flow>  ──────►│                             │
   │    { credential }            │── verifyIdToken(credential) ►│
   │                              │◄── payload {sub,email,…} ────│
   │                              │                             │
   │                              │  assert email_verified===true
   │                              │  look up users by email
   │                              │  assert role matches portal
   │                              │  assert approval/verification gates
   │                              │                             │
   │ ◄── { user, token } ─────────│  sign HS256 JWT, exp 7d     │
   │                              │                             │
   │  localStorage:               │
   │   token / user   (customer, milkman)
   │   admin_token / admin_user   (admin)
```

**App JWT:** HS256, secret `JWT_SECRET`, `expiresIn: '7d'`, payload `{ id, role }`
(admin flow also includes `name`). Sent as `Authorization: Bearer <token>`.

There are **no refresh tokens and no revocation list**. Instead, the `authenticate` middleware
re-reads the user row from the database on *every single request*, so a deleted, rejected or
demoted user is locked out within one request. This costs one DB round-trip per API call.

### Three separate Google entry points

| Endpoint | Portal | Extra rules |
|---|---|---|
| `POST /auth/google` | Customer | user must already exist; must be `role='customer'`; must be approved |
| `POST /auth/google-milkman` | Milkman | user must exist with `role='milkman'` |
| `POST /auth/google-login` | Admin | email must be in `ADMIN_EMAILS` **or** the `admins` table; auto-creates/upgrades the `users` row to `role='admin'` |

All three verify the token against the **same** Google client ID
(`GOOGLE_CLIENT_ID` server-side, `VITE_GOOGLE_CLIENT_ID` client-side).

> On rebuild, collapse these into **one** `POST /auth/google { credential, portal }` handler.
> Three near-identical 200-line handlers is where the `token` vs `credential` field-name bug
> came from (see [09-known-defects.md](09-known-defects.md#auth-1)).

## 3.2 Registration

### Customer — `POST /auth/register-customer`

Public, no auth. Validates and creates in this order:

1. **Required:** `name`, `email`, `phone`, `milkman_id`, `street`/`address_line1`, `area`/`delivery_area`, `city`, `state`, `pincode`. Optional: `landmark`/`address_line2`, `delivery_instructions`.
2. **Email must be free.** If taken, the error names the existing role so the user is sent to the right portal.
3. **Milkman must exist, have `role='milkman'`, and `milkman_profiles.is_verified = true`.**
4. **The chosen delivery area must actually belong to that milkman.** Checked through three fallbacks in order — `milkman_zones` → `zones.milkman_id` → `milkman_profiles.service_areas`. Match is by zone id, name, display name, or pincode membership. Fails with 400 if none match.
5. **The milkman must have a live subscription:** `milkman_subscriptions.status IN ('active','trial') AND end_date >= now()`.
6. **If that subscription is a trial, the milkman must be under `trial_customer_limit`.** Note this pre-check counts *all* customers regardless of approval, whereas the approval-time check counts only approved ones — see [04-business-logic.md](04-business-logic.md#customer-limit-enforcement).
7. Create `users` row: `role='customer'`, `is_approved=false`, `approval_status='pending'`, `milkman_id`, `delivery_area`, random bcrypt password.
8. Create default `addresses` row.
9. Notify the milkman.

The customer then sits on a polling "pending approval" screen.

### Milkman — Google sign-in on the milkman portal

No separate registration endpoint is wired. First Google sign-in creates the `users` row with
`role='milkman'`; the profile and trial are created from the milkman portal afterwards.

### Admin — implicit

First Google sign-in from an allowlisted email auto-creates a `users` row with `role='admin'`,
or upgrades an existing row's role to `admin`.

## 3.3 State machines

### Customer approval

```
                     register
                        │
                        ▼
                   ┌─────────┐
                   │ pending │  is_approved=false, approval_status='pending'
                   └────┬────┘  → cannot log in (403); sees pending screen
              ┌─────────┴─────────┐
      milkman approves      milkman rejects
              │                   │
              ▼                   ▼
        ┌──────────┐        ┌──────────┐
        │ approved │        │ rejected │  subscriptions → is_active=false
        └──────────┘        └──────────┘  pending deliveries DELETED
   is_approved=true                       → cannot log in (403)
   subscription activated
   today's delivery created
```

Enforced in **three** places — `authenticate` middleware, `GET /auth/verify-status`, and each
Google login handler — with subtly different code each time. Centralise it on rebuild.

A legacy-tolerance rule runs everywhere:
```js
const isApproved     = user.is_approved !== undefined ? user.is_approved : true;
const approvalStatus = user.approval_status || 'approved';
```
i.e. **NULL means approved**, for rows predating the approval feature. Decide explicitly whether
you want that; if not, backfill and make both columns NOT NULL.

### Milkman access

Two independent gates, both required:

```
     ┌────────────────────────┐        ┌──────────────────────────────┐
     │ milkman_profiles       │  AND   │ milkman_subscriptions        │
     │ .is_verified = true    │        │ status ∈ {active, trial}     │
     │ (admin-controlled)     │        │ AND not past end_date        │
     └────────────────────────┘        └──────────────────────────────┘
                     │                          │
                     └────────┬─────────────────┘
                              ▼
                     full milkman panel
```

Failing the subscription gate should return **HTTP 402 Payment Required** and redirect the UI
to `/select-plan`. Failing verification should hold them on a "pending admin verification" screen.

> ⚠️ **In the current build the subscription gate is client-side only.** The middleware that
> enforces it (`requireMilkmanSubscription`) is written but never mounted on any route, so the
> API serves a milkman with an expired trial normally. See
> [09-known-defects.md](09-known-defects.md#auth-2). **Mount it on rebuild.**

## 3.4 Authorization matrix

Route-level middleware in the current build:

| Router | Mounted at | Guard |
|---|---|---|
| `auth` | `/api/auth` | none (public by design) |
| `subscription` | `/api` | per-route `authenticate`; several routes fully public |
| `customer` | `/api/customer` | `authenticate` + `authorize('customer')` |
| `milkman` | `/api/milkman` | `authenticate` + `authorize('milkman')` |
| `admin` | `/api/admin` | `authenticate` + `authorize('admin')` |
| `addresses` | `/api/addresses`, `/api/pincodes` | 2 public pincode routes, then `authenticate` |
| `zones` | `/api/zones` | `authenticate` + per-route `authorize('milkman')` |
| `payments` | `/api/payments` | `authenticate` + per-route `authorize(...)` |
| `push-notifications` | `/api/push-notifications` | per-route `authenticate`; `/vapid-key` public |

### Intentionally public endpoints

| Endpoint | Why |
|---|---|
| `POST /auth/login`, `/auth/register`, `/auth/register-customer` | signup/login |
| `POST /auth/google`, `/auth/google-milkman`, `/auth/google-login` | login |
| `GET /auth/verify-status` | does its own token check |
| `GET /api/plans/active`, `/api/subscription/plans[/active]` | pricing page |
| `GET /api/milkmen/active` | milkman picker at signup |
| `GET /api/milkmen/:id/delivery-areas` | area picker at signup |
| `GET /api/milkmen/:id/subscription-plans` | plan preview at signup |
| `GET /api/addresses/check-pincode/:pincode`, `/check/:pincode` | serviceability at signup |
| `GET /api/push-notifications/vapid-key` | public key by definition |

### Endpoints that must NOT be public (currently are)

| Endpoint | Problem |
|---|---|
| `GET/POST /auth/check-approval-status` | **issues a valid 7-day JWT given only an email or phone number.** Unauthenticated account takeover. See [09-known-defects.md](09-known-defects.md#auth-3). |

### Tenancy rules

| Actor | May read/write |
|---|---|
| Customer | only rows where `customer_id = self`; plans only where `subscription_plans.milkman_id = self.milkman_id` |
| Milkman | only rows where `milkman_id = self`; customers only where `users.milkman_id = self` |
| Admin | everything |

Every customer-facing plan query filters by the customer's assigned `milkman_id` — this is
correct and deliberate (the code even comments it as a security check). Preserve it: a customer
must never see or subscribe to another milkman's plans.

## 3.5 Rate limiting

**There is none.** `express-rate-limit` is in `package.json` but all middleware was removed
(commit `ba5f321`, "Remove rate limit middleware from backend routes") after it caused 429s in
production.

Combined with the public JWT-minting endpoint above, this is exploitable. Reinstate limits on
rebuild, but scope them properly:

| Scope | Suggested |
|---|---|
| Auth endpoints, per IP | 20 / 15 min |
| Approval-status lookup, per IP | 5 / 15 min |
| General API, per authenticated user | 600 / 15 min |
| Verify-status / polling endpoints | exempt, or much higher |

The original failure was a single global limiter that counted the 10-second notification polls.
Exempt polling routes, or replace polling with server push entirely
([10-rebuild-guide.md](10-rebuild-guide.md#realtime)).

## 3.6 Security headers and CORS

`helmet` with:
- `crossOriginOpenerPolicy: 'same-origin-allow-popups'` — **required** for the Google popup flow.
- `crossOriginResourcePolicy: 'cross-origin'`.
- CSP allowing `accounts.google.com` and `apis.google.com` in `script-src` and `frame-src`,
  Google Fonts in `style-src`/`font-src`, `'unsafe-inline'` for scripts and styles.

> `script-src 'unsafe-inline'` defeats most of the XSS protection CSP provides. On rebuild,
> use nonces or hashes.

CORS is an explicit allowlist from `CORS_ORIGINS` (comma-separated), defaulting to
localhost:5173/5174/5175/5176/3000/3001 plus the three production hosts. Credentials enabled;
methods GET/POST/PUT/DELETE/PATCH/OPTIONS; headers `Content-Type`, `Authorization`.

`app.set('trust proxy', true)` is set for real client IPs behind a reverse proxy.

The Vercel configs for each SPA add the matching `Cross-Origin-Opener-Policy:
same-origin-allow-popups` and `Cross-Origin-Embedder-Policy: unsafe-none`, plus an SPA
rewrite of everything to `/index.html`.

## 3.7 Environment variables

**Server**

| Var | Required | Notes |
|---|---|---|
| `PORT` | no | default 5000; set to 3001 locally |
| `NODE_ENV` | yes | **`development` unlocks dev backdoors and debug routes** |
| `SUPABASE_URL` | yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | bypasses RLS — server only, never ship to a client |
| `SUPABASE_ANON_KEY` | no | only used for an unused public client |
| `JWT_SECRET` | yes | ⚠️ one code path falls back to a hardcoded literal if unset |
| `GOOGLE_CLIENT_ID` | yes | must match the clients' `VITE_GOOGLE_CLIENT_ID` |
| `ADMIN_EMAILS` | yes | comma-separated admin allowlist |
| `CORS_ORIGINS` | no | comma-separated; falls back to the built-in list |
| `APP_TIMEZONE` | no | default `Asia/Kolkata` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | no | **unset** → online payments disabled |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | no | **unset** → web push disabled |

**Each client**

| Var | Notes |
|---|---|
| `VITE_API_URL` | e.g. `http://localhost:3001/api` |
| `VITE_GOOGLE_CLIENT_ID` | must equal the server's `GOOGLE_CLIENT_ID` |

> Never let `GOOGLE_CLIENT_ID` have a hardcoded fallback. The admin app currently falls back to
> a client ID from a *different* Google project, which would produce a baffling `invalid_client`
> rather than a clear config error.

## 3.8 Google Cloud Console setup

For the OAuth client:

- **Authorized JavaScript origins:** every origin that renders the Google button —
  `http://localhost:5173`, `:5174`, `:5175` in dev, plus each production domain.
- **Authorized redirect URIs:** not needed. The apps use `@react-oauth/google`'s ID-token
  (`GoogleLogin`) flow, which is popup/`postMessage`-based, not a redirect flow.
- The token is verified server-side with `audience = GOOGLE_CLIENT_ID` and
  `email_verified === true` is asserted. Keep both checks.
