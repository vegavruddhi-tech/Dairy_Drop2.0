# 6. Customer Portal

`client-customer` · dev port **5173** · installable PWA · en / hi / gu.

The customer is a household in an Indian tier-1/2 city, usually on a mid-range Android phone,
often not reading English. Design accordingly: large tap targets, one primary action per screen,
currency always as `₹1,810`, Hindi and Gujarati as first-class.

## 6.1 Shell

```
BrowserRouter
└── LanguageProvider                      en | hi | gu, persisted to localStorage
    ├── AppOpenAnimation                  splash: "Customer Portal"
    ├── PWAInstallBanner                  beforeinstallprompt
    ├── Toaster                           top-center, pill-shaped, 3.5 s
    └── Routes
        ├── /login             CustomerLogin     (public)
        ├── /register          SimpleRegister    (public)
        ├── /pending-approval  PendingApproval   (public)
        └── /                  ProtectedRoute → MainLayout
            ├── index          Dashboard
            ├── /shop          ShopAndOrders
            ├── /billing       BillingAndPayments
            ├── /subscriptions Subscriptions
            ├── /profile       Profile
            ├── /settings      Settings
            └── /calendar      MilkHistory   (alias /milk-history)
```

**Legacy redirects** — `/history`→`/calendar`, `/available-products`·`/my-orders`·`/orders`→`/shop`,
`/payments`·`/invoices`→`/billing`, `*`→`/`.

### ProtectedRoute

On mount, then every **5 minutes**:

1. Read `token` + `user` from `localStorage`; rehydrate Zustand if the store is empty.
2. No session → `logout()`, render `<Navigate to="/login">`.
3. `role === 'milkman'` → hard-redirect to the milkman origin (swap `5173`→`5174`, or
   `customer`→`milkman` in the hostname).
4. `role !== 'customer'` → logout.
5. `GET /auth/verify-status`; on 401/403 → logout.

Renders `null` while checking, to avoid a flash of authenticated content.

### MainLayout

Header + Sidebar (drawer on mobile) + `<Outlet/>` + a fixed bottom nav on mobile.

**Sidebar:** Dashboard `/` · Additional Order `/shop` · Billing & Payments `/billing` ·
My Subscription `/subscriptions` · Profile `/profile` · Settings `/settings`.

## 6.2 Auth screens

### CustomerLogin — `/login`

Google sign-in only (`GoogleLogin` inside a `GoogleOAuthProvider` scoped to this page).

```
onSuccess(credentialResponse):
    decoded = jwtDecode(credentialResponse.credential)
    POST /auth/google { credential, email, name, picture }   ← must be "credential"
    persist token + user to localStorage and Zustand
    navigate('/')
```

Error handling by status:
- **403** with `status: 'pending'|'rejected'` → store the payload and route to `/pending-approval`.
- **404** with `requiresRegistration` → route to `/register`.
- **Anything else** → toast.

> ⚠️ The shipped file sends `token:` instead of `credential:`. See
> [09-known-defects.md](09-known-defects.md#auth-1).

### SimpleRegister — `/register`

The signup funnel. Steps:

1. **Google identity** — prefill name and email from the ID token; they are not editable.
2. **Pincode** → `GET /addresses/check-pincode/:pincode`. On `available: false`, stop with
   "we don't deliver here yet".
3. **Milkman** → `GET /milkmen/active`, cards showing business name and coverage.
4. **Area** → `GET /milkmen/:id/delivery-areas` for the chosen milkman.
5. **Address** — street, area, city, state, pincode, landmark, delivery instructions.
6. **Plan preview** (optional) → `GET /milkmen/:id/subscription-plans`.
7. `POST /auth/register-customer` → route to `/pending-approval`.

### PendingApproval — `/pending-approval`

Holding screen showing the chosen milkman's name and phone. Polls
`/auth/check-approval-status` on an interval; on approval it receives a token and auto-logs-in.

> This auto-login convenience is exactly what makes that endpoint dangerous. On rebuild, poll an
> endpoint that returns **status only**, and make the user sign in with Google.

## 6.3 Dashboard — `/`

The default screen. Refetches every **30 s** and on window focus.

**Data:** `/customer/deliveries/today`, `/customer/stats`, `/customer/available-products`,
`/customer/milkman-payment-info`, `/addresses/default`,
`/customer/deliveries/history?month=<current>`.

**Sections, top to bottom:**

1. **Greeting** — time-of-day aware ("Good morning, Priya"), localised.
2. **Today's delivery card** — one card **per active subscription**, swipeable when there are
   several (`activeSlideIndex`). Shows product, quantity, slot, and a status pill:
   `pending` amber · `delivered` green · `skipped` grey · `undelivered` red.
   Two actions while pending: **Skip today** and **Change quantity**.
3. **Week strip** — the last 7 days as dots coloured by status, from the history endpoint.
4. **Stats** — active plans, deliveries this month, total deliveries.
5. **Fresh catalog** — horizontally scrolling `daily_products` with a one-tap order sheet.
6. **Milkman card** — name, phone (tap to call), UPI ID and QR for payment.
7. **Delivery instructions** — inline editor writing back to the default address.

**Modals:** skip (reason chips: *Out of Town*, *Travelling*, *Enough stock*, custom),
quantity (stepper in 0.5 L increments), product order (quantity × price preview).

**Mutations:** `POST /customer/deliveries/skip-date`, `/deliveries/change-quantity`,
`/purchase-product`, `PUT /addresses/:id`.

## 6.4 ShopAndOrders — `/shop`

A tab host with four tabs, each an independently-fetching page component:

| Tab | Component | Data |
|---|---|---|
| Fresh Catalog | `AvailableProducts` | `/customer/available-products` (30 s poll) |
| Extra Orders | `MyOrders` | `/customer/my-orders` (30 s poll) |
| Calendar | `MilkHistory` | `/customer/deliveries/history?month=` |
| Daily Logs | `Orders` | `/customer/orders/recent` |

`AvailableProducts` shows stock ("Only 3 kg left"), disables out-of-stock items, and posts to
`/customer/purchase-product`. Product images are matched from `name` by substring against the
nine bundled images, with a generic fallback.

## 6.5 BillingAndPayments — `/billing`

Two tabs: **Payments** (`Payments`) and **Invoices** (`Invoices`).

### Payments tab

`GET /customer/deliveries/billing-breakdown?month=<current>` plus
`/customer/milkman-payment-info` and `/payments/history`.

Shows the amount due, the milkman's UPI QR, and a submission form:

```
{ billId: '<YYYY-MM>', paymentMethod: 'UPI'|'Cash', utrNumber, amount, note }
  → POST /payments/submit-offline-payment
```

Then the payment shows as *awaiting confirmation* until the milkman verifies it.

### Invoices tab

Month picker → billing breakdown for that month, and
`GET /customer/invoices/history?limit=12&offset=` for a paginated list of past months.

**The invoice renders the full breakdown:**

| Line | Field |
|---|---|
| Plan | `subscriptionPlanName`, `subscriptionQuantity`, `subscriptionDeliveryTime` |
| Rate | `dailyRate`, `pricePerUnit` |
| Delivered | `deliveredDays` days, `totalDeliveredLitres` L |
| Regular milk | `regularDeliveredLitres` L → `regularMilkAmount` |
| Extra milk | `extraMilkLitres` L → `extraMilkAmount` |
| Reduced | `reducedMilkLitres` L |
| Skipped / undelivered | `skippedDays`, `undeliveredDays` |
| Products | `additionalProductsAmount` + the `productPurchases` list |
| **Total** | `totalBillAmount` |
| Paid | `totalPaidAmount` |
| **Balance** | `balanceDue` (or `advanceCredit`) |

`html2pdf.js` is a dependency for PDF export of the invoice.

## 6.6 Subscriptions — `/subscriptions`

**Data:** `/customer/subscriptions`, `/customer/subscription-plans`,
`/customer/plan-change-requests`, `/milkmen/:id/subscription-plans`.

- **My plans** — one card per subscription: product, quantity, slot, frequency, monthly price,
  status. Actions: Pause / Resume / Cancel (confirm) / Request change.
- **Available plans** — the assigned milkman's catalog, with **Subscribe** for an additional plan
  (`POST /customer/subscriptions`).
- **Change request** — modal that requires a reason (server enforces non-empty), posts to
  `/customer/plan-change-requests`. Shows current vs requested side by side. Blocks a second
  request while one is pending (409).

## 6.7 MilkHistory — `/calendar`

Month calendar grid. Each day is coloured by status and shows the delivered quantity. Tapping a
day opens the detail (product, quantity vs standard, slot, timestamp, reason).

Summary panel from `/customer/deliveries/history?month=`:
`milk: { totalDelivered, totalSkipped, totalUndelivered, totalQuantity, standardQuantity,
extraMilk, reducedMilk }` and `products: { totalOrdered, totalDelivered, totalSpent }`.

> Note `extraMilk`/`reducedMilk` here are **gross per-day** sums, while the invoice's
> `extraMilkLitres` is a **net monthly** figure. They legitimately differ. Pick one definition
> on rebuild — gross is more informative, net is what the money is based on.

## 6.8 Profile and Settings

**Profile** — name/phone (`PUT /customer/profile`), full address CRUD against `/addresses`
with pincode validation, plus lifetime stats.

**Settings** — language switcher (en/hi/gu), notification preferences, PWA install prompt,
logout.

## 6.9 State, i18n and styling

**Auth store** (Zustand + `persist`, key `auth-storage`): `{user, token, isAuthenticated}` with
`login`, `logout`, `updateUser`. Data is written to **both** the store and raw `localStorage`
keys (`token`, `user`) because `ProtectedRoute` reads the raw keys directly. Redundant —
use one source on rebuild.

**API client** (axios): request interceptor attaches the bearer token; response interceptor on
**401** clears all storage, calls `logout()`, and hard-redirects to `/login` unless already on
`/login` or `/register`.

**i18n** — a hand-rolled `LanguageContext` with `t(path, params?, default?)` over three locale
objects (~350 keys each). Formatters handle Indian numbering (lakh/crore), `₹`, and
`toLocaleDateString('en-IN')`.

> ⚠️ Only ~176 `t()` calls exist across the app, against **1,033 inline
> `language === 'hi' ? … : …` ternaries** app-wide. Most strings bypass the translation layer,
> and Gujarati is frequently missing from those ternaries (they test only for `hi`). **On
> rebuild, all user-facing strings go through the catalog — no exceptions.**

**Styling** — Tailwind with a green `primary` scale (`#22c55e` / `#16a34a`), plus
`promotional`/`success`/`warning`/`danger`/`accent` scales. Fonts: Inter, Sora,
Cormorant Garamond via `@fontsource`. Heroicons 24 outline/solid. Headless UI for
dialogs/transitions. Page background `#faf8f5`.

Shared UI: `CowLoader` (branded spinner), `NotificationBell` (10 s poll), `StatCard`, `Badge`,
`EmptyState`, `LoadingSpinner`, `LanguageToggle`, `PWAInstallBanner`, `InstallAppButton`,
`AppOpenAnimation`.

## 6.10 PWA

`vite-plugin-pwa`, `registerType: 'autoUpdate'`, `generateSW`. Manifest: *DairyDrop Customer*,
theme `#10b981`, standalone, scope `/`. Runtime caching for Google Fonts (CacheFirst, 1 year).
`suppressSwErrors.ts` silences noisy service-worker console errors.

> ⚠️ Two competing Vite configs exist (`vite.config.js` **and** `vite.config.ts`). Vite resolves
> `.js` first, so the `.ts` config — with manual chunk splitting, `optimizeDeps` and path
> aliases — is **dead**. See [09-known-defects.md](09-known-defects.md#build-1).

<a id="dead-pages"></a>

## 6.11 Dead pages

Unreachable from `App.tsx`. **Do not port.**

| File | Why |
|---|---|
| `pages/Auth/Login.tsx` | superseded by `CustomerLogin` (ironically it has the *correct* `credential` field) |
| `pages/Auth/CustomerRegister.tsx` | superseded by `SimpleRegister` |
| `pages/Auth/MilkmanLogin.tsx` | wrong app |
| `pages/LandingPage.tsx` | never routed |
| `pages/customer/AdditionalOrders.tsx` | calls deleted `/customer/additional-orders` endpoints |
| `pages/customer/AddressManagement.tsx` | folded into `Profile` |

Also dead: `src/App.jsx`, `src/main.jsx` (Vite template leftovers), `README.md` (stock template).
