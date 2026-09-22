# Architecture notes

Decisions worth the reasoning, for whoever picks this up next.

## One app, three panels

Route groups — `(customer)`, `(milkman)`, `(admin)` — with `middleware.js`
routing by role. The alternative was three Next apps in a monorepo.

**Why one:** the previous system's three SPAs each carried their own copy of the
API client, the auth store, the layout, the toast config and a dozen UI
components, and every copy had drifted. Verified: every shared file had a
different hash across the three apps. One app removes the category of bug.

**What it costs:** one PWA manifest instead of three installable apps, and one
deploy for all three audiences. If the milkman app ever needs to install
separately with its own icon, split that one out — the service layer does not
change.

## Why the domain layer imports nothing

`src/domain/` has no imports from `db`, `auth`, `next` or anything else in the
project. That constraint is what makes `computeBill` testable without a database
and what lets the customer invoice and the milkman earnings screen share it.

It is also the answer to the old system's worst structural problem: billing
arithmetic was scattered across five route files with three different fallback
rates and two different month lengths, so the two sides could never agree.

## Why scoping lives in the repository, not the service

`tenantFilter()` requires an actor and throws without one. A service *cannot*
accidentally read across tenants, because it cannot build an unscoped query.

The previous system put the filter in each of ~150 call sites and relied on
remembering it. One omission is a cross-tenant leak.

## Why subscriptions are versioned

A plan change closes the current row (`effectiveTo = today`) and opens a
successor tomorrow, sharing a `rootId`. Deliveries reference the `rootId`, so
history is never orphaned.

The alternative — rewriting the row in place, as the old system did — means a
month spanning a plan change bills entirely at the new price. That is a support
ticket every time it happens.

## Why `payments.billId` is NOT NULL

The old bill summed every payment a customer had ever made against a single
month. From month two onward every month read "paid" with a large "advance
credit", and `balanceDue` was zero for people who owed money.

Making the column non-nullable makes that bug unexpressible.

## Why the paywall is checked on every action

`requireMilkman()` costs one indexed lookup per mutation. That is a real cost,
paid deliberately: the alternative is the client being the only thing between an
expired trial and full access, which is exactly what the previous system shipped.

`requireMilkman({ allowUnpaid: true })` is the explicit escape hatch, used by
precisely three actions — start trial, submit payment, cancel — all of which a
paywalled milkman must be able to reach.

## Why Clerk holds identity and the database holds authorization

Clerk is very good at the thing it does: credentials, sessions, MFA, email
verification, a sign-in UI that handles the twenty edge cases nobody wants to
write twice. Handing that over removed roughly 400 lines of auth plumbing and a
whole class of bug.

What did **not** move is authorization. Role, tenant and approval state stay in
the `users` table, joined to Clerk by `users.clerkId`.

The tempting alternative is mirroring roles into Clerk's `publicMetadata` and
reading them from the session token — no database round-trip, and the edge can
see them. It was rejected because:

- A customer's tenant is a **foreign key**. `milkman_id` references a real row
  that the database guarantees exists. A string in a metadata blob guarantees
  nothing, and nothing stops it drifting.
- It would create two sources of truth for access. When they disagree — and they
  will, because metadata updates are a separate API call that can fail — the
  question "which one wins?" has no good answer.
- Approval state changes as a side effect of a milkman's action, inside a
  transaction with a notification and an audit entry. It belongs in that
  transaction.

The role **is** mirrored into `publicMetadata`, but only as a routing hint for
the edge middleware, and `middleware.js` says so explicitly. Nothing authorizes
from it.

## Why middleware does no authorization

Clerk deprecated `auth.protect()` and `createRouteMatcher` for exactly the
reason this codebase already assumed: middleware authorization is path matching,
and path matching can diverge from how Next.js actually routes a request. A
route group, a rewrite or a parallel route can leave a path reachable that the
matcher believed it had covered.

So `middleware.js` establishes the session and nothing else. Every real decision
happens in the layout, action or query that touches the data — where it cannot
diverge, because it *is* the thing touching the data.

## Why being signed out redirects instead of throwing

`requireActor()` calls `redirect('/sign-in')` rather than throwing when there is
no session. Next renders a layout and its page in parallel, so an anonymous
request reaches both; throwing produced a stack trace on every ordinary
logged-out page view while the layout was already redirecting correctly.

Authorization failures still throw — a signed-in user hitting something they may
not have is a real event worth seeing in the logs.

This made a latent bug visible: `defineAction` caught everything, including
Next's `redirect()` control-flow signal, which would have turned any redirect
inside an action into a silent no-op. It now re-throws anything carrying a
`NEXT_REDIRECT` or `NEXT_NOT_FOUND` digest.

## Why stock uses a conditional UPDATE

```sql
UPDATE products SET available_quantity = available_quantity - $qty
 WHERE id = $id AND available_quantity >= $qty
RETURNING *;          -- zero rows ⇒ someone else took the last of it
```

Read-then-write lets two concurrent orders for the last unit both succeed. The
`CHECK (available_quantity >= 0)` constraint is the backstop.

## Why notifications are archived, not deleted

The old system hard-deleted anything older than 30 hours, on every read. Losing
a payment-confirmation notice after a day and a half is a support ticket. Here
it is a soft delete after 90 days, run weekly.

## What is deliberately not built

- **Online card payments.** Razorpay was wired into the old system and never
  configured. Money moves by UPI and cash; the app records and verifies it.
  Add a gateway when someone asks.
- **Route optimisation.** `serviceAreas.routeSequence` orders the round. Real
  optimisation needs geocoding and a solver, and the milkman already knows their
  streets better than a solver would.
- **Push notifications.** The old code carried ~350 lines of VAPID plumbing that
  could never have worked — no keys, and the table it wrote to did not exist.
  In-app notifications work; add web push deliberately when it is wanted.
- **Multi-language.** The old customer and milkman apps had en/hi/gu catalogs
  that ~1,000 inline `language === 'hi' ? … : …` ternaries bypassed, so Gujarati
  speakers silently got English. Better to add i18next properly, with a lint
  rule banning literal JSX strings and a CI check that the catalogs match, than
  to recreate a system that lies about its own coverage.

## Where to start reading

1. `src/auth/roles.js` — the permission matrix. The whole access model on one screen.
2. `src/auth/provision.js` — the seam between Clerk and this application's model.
3. `src/domain/billing.js` — what anyone owes, and why.
4. `src/repositories/base.js` — why a cross-tenant leak is hard to write.
5. `src/actions/action.js` — the four fixed steps every mutation passes through.
