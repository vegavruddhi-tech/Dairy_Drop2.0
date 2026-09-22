/**
 * The shared application shell, ported from the original apps' layout.
 *
 * The mobile chrome is the part that mattered: a floating pill-shaped bottom
 * bar rather than a full-width strip, so it reads as an object sitting on the
 * page. Four primary destinations plus a menu, which is what fits on a phone
 * held one-handed.
 *
 * One shell serves all three panels; only the navigation items differ. The
 * previous system had three separate copies of the layout, header and sidebar
 * that had drifted apart.
 */

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

import { cn, Badge } from '@/components/ui/index.jsx';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { NavLink, MoreMenu } from './Nav.jsx';

/**
 * @param {object} props
 * @param {Array}  props.nav   primary destinations (first four get the bottom bar)
 * @param {Array}  [props.more] overflow destinations
 * @param {{name: string, email: string, role: string}|null} [props.user]
 *   **Must be serializable** — this reaches `<MoreMenu>`, a client component.
 *   Use `toViewer(actor)` from `@/auth/session.js`; a raw `ActorContext`
 *   carries functions and will throw at the boundary.
 */
export function AppShell({ nav, more = [], user, title, badge, children }) {
  const primary = nav.slice(0, 4);

  return (
    <div className="min-h-dvh bg-bg">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm text-white"
          >
            🥛
          </span>
          <span className="font-heading text-[15px] font-extrabold tracking-tight text-ink">
            DairyDrop
          </span>
          {badge ? <Badge tone="brand">{badge}</Badge> : null}
        </div>

        <nav className="space-y-0.5 p-3" aria-label="Main">
          {[...nav, ...more].map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/*
          Clerk's UserButton owns the account menu — profile, security, sign
          out. Rolling our own would mean reimplementing session management
          Clerk already does properly.
        */}
        <div className="absolute inset-x-0 bottom-0 space-y-3 border-t border-border p-3">
          <LanguageToggle />
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} showName />
          </div>
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 pt-safe backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs text-white"
          >
            🥛
          </span>
          <span className="font-heading text-[15px] font-extrabold tracking-tight text-ink">
            {title ?? 'DairyDrop'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageToggle variant="compact" className="h-8" />
          <UserButton appearance={{ elements: { avatarBox: 'h-7 w-7' } }} />
          <MoreMenu items={more} user={user} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="pb-nav lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-5 lg:py-8">{children}</div>
      </main>

      {/* ── Mobile bottom bar ───────────────────────────────────────────── */}
      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pt-1 lg:hidden"
        style={{ paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 8px))' }}
      >
        {/* Floating pill, not a full-width strip — as the old apps had it. */}
        <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-emerald-200/90 bg-surface/95 shadow-nav backdrop-blur-xl">
          <ul className="flex items-center justify-around gap-1 px-2 py-1.5">
            {primary.map((item) => (
              <li key={item.href} className="flex min-w-0 flex-1">
                <NavLink {...item} compact />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
