/**
 * Edge middleware.
 *
 * Its only jobs are to establish the Clerk session and to nudge a signed-in user
 * toward the right home page. It does **no** authorization.
 *
 * That is deliberate, and it matches Clerk's own guidance: `auth.protect()` and
 * `createRouteMatcher` are deprecated precisely because middleware authorization
 * relies on path matching, which can diverge from how Next.js actually routes a
 * request and leave a protected resource reachable. Clerk's recommendation is
 * resource-based checks — auth in the page, layout, route handler or Server
 * Function that touches the data.
 *
 * This codebase was already built that way:
 *
 *   · every layout calls `getActor()` / `gateStatus()` and redirects
 *   · every Server Action goes through a guard in `src/auth/session.js`
 *   · every query is built from an actor by `src/repositories/base.js`
 *   · `src/db/rls.sql` enforces the same rules in Postgres
 *
 * So there is nothing for the middleware to protect. Keeping it thin also keeps
 * it fast: it runs on every matched request.
 */

import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { ROLE_HOME } from '@/auth/roles.js';

/**
 * A cheap, non-authoritative hint at the user's role.
 *
 * Mirrored into Clerk's `publicMetadata` by the webhook purely so the edge has
 * something to route on without a database round-trip (which the edge runtime
 * cannot do anyway). It is a cache, never a source of truth: if it is missing or
 * stale, the request simply reaches the layout, which resolves the real role
 * from the database and redirects properly.
 *
 * Authorization is never decided from this value.
 */
function roleHint(sessionClaims) {
  const role = sessionClaims?.metadata?.role ?? sessionClaims?.publicMetadata?.role;
  return typeof role === 'string' ? role : null;
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // The marketing root is not useful once you are signed in with a recognized role.
  if (pathname === '/') {
    const { userId, sessionClaims } = await auth();
    if (userId) {
      const hint = roleHint(sessionClaims);
      if (hint && ROLE_HOME[hint]) {
        return NextResponse.redirect(new URL(ROLE_HOME[hint], request.nextUrl.origin));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /**
     * Everything except Next internals and static assets. Middleware runs on
     * every match and each run costs a session verification, so keep it tight.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)',
    // API and tRPC routes, then Clerk's auto-proxy path.
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
